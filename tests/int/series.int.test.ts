import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { lexicalFromBlocks } from '@/lib/lexicalBuilder'
import { getPostSeries, getRelatedPosts } from '@/lib/queries'
import { setRevalidator } from '@/lib/revalidate'
import { seed } from '@/seed/seed'

let payload: Payload
const run = Date.now().toString(36)
const cleanup: { collection: 'posts' | 'series'; id: string }[] = []

const publishedData = (title: string, extra: Record<string, unknown> = {}) =>
  ({
    title,
    _status: 'published',
    publishedAt: '2026-01-10T12:00:00.000Z',
    content: lexicalFromBlocks(['Um parágrafo do teste de séries e relacionados.']),
    summary: `Síntese do teste de integração de séries e relacionados, com texto suficiente pra passar na validação de tamanho mínimo da síntese do post, que pede entre 160 e 400 caracteres ${run}.`,
    keyPoints: [{ text: 'Um' }, { text: 'Dois' }, { text: 'Três' }],
    summarySource: 'manual',
    ...extra,
  }) as never

describe('séries e relacionados (passo 9)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    await seed(payload)
  })
  afterAll(async () => {
    setRevalidator(null)
    for (const { collection, id } of cleanup.reverse()) {
      await payload.delete({ collection, id }).catch(() => undefined)
    }
    await payload.destroy()
  })

  it('seed: série "Homelab do zero" na ordem de leitura salva', async () => {
    const mid = await getPostSeries('diario-de-bordo-backup-que-funciona')
    expect(mid).toMatchObject({ title: 'Homelab do zero', index: 2, total: 3 })
    expect(mid?.prev?.href).toBe('/posts/payload-cms-mongodb-minio-docker')
    expect(mid?.next?.href).toBe('/posts/ia-local-no-homelab-sem-gpu')
    const first = await getPostSeries('payload-cms-mongodb-minio-docker')
    expect(first).toMatchObject({ index: 1, prev: null })
    const last = await getPostSeries('ia-local-no-homelab-sem-gpu')
    expect(last).toMatchObject({ index: 3, next: null })
  })

  it('relacionados não repetem as partes da série', async () => {
    const related = await getRelatedPosts('diario-de-bordo-backup-que-funciona')
    const slugs = related.map((p) => p.slug)
    expect(slugs).not.toContain('payload-cms-mongodb-minio-docker')
    expect(slugs).not.toContain('ia-local-no-homelab-sem-gpu')
    expect(slugs.length).toBeGreaterThan(0)
  })

  it('post fora de série e slug inexistente não têm navegação', async () => {
    expect(await getPostSeries('o-mito-do-dev-10x')).toBeNull()
    expect(await getPostSeries(`nao-existe-${run}`)).toBeNull()
  })

  it('rascunho na série fica de fora; publicar inclui; salvar invalida o cache', async () => {
    const tags: string[] = []
    setRevalidator((t) => tags.push(t))
    const draft = await payload.create({
      collection: 'posts',
      draft: true,
      data: { title: `Parte rascunho ${run}`, _status: 'draft' } as never,
    })
    cleanup.push({ collection: 'posts', id: String(draft.id) })
    const ids = await payload.find({
      collection: 'posts',
      where: { slug: { in: ['o-mito-do-dev-10x', 'primeiro-emprego-em-tech-conselhos'] } },
      depth: 0,
    })
    const bySlug = new Map(ids.docs.map((d) => [d.slug, String(d.id)]))
    const series = await payload.create({
      collection: 'series',
      data: {
        title: `Carreira em série ${run}`,
        posts: [
          bySlug.get('primeiro-emprego-em-tech-conselhos')!,
          String(draft.id),
          bySlug.get('o-mito-do-dev-10x')!,
        ],
      } as never,
    })
    cleanup.push({ collection: 'series', id: String(series.id) })
    expect(series.slug).toBe(`carreira-em-serie-${run}`)
    expect(tags).toContain('posts')

    const nav = await getPostSeries('o-mito-do-dev-10x')
    expect(nav).toMatchObject({ index: 2, total: 2 })
    expect(nav?.parts.map((p) => p.title)).not.toContain(`Parte rascunho ${run}`)

    await payload.update({
      collection: 'posts',
      id: String(draft.id),
      data: publishedData(`Parte rascunho ${run}`),
    })
    const after = await getPostSeries('o-mito-do-dev-10x')
    expect(after).toMatchObject({ index: 3, total: 3 })
    expect(after?.prev?.title).toBe(`Parte rascunho ${run}`)
  })

  it('série exige pelo menos 2 posts', async () => {
    const one = await payload.find({ collection: 'posts', limit: 1, depth: 0 })
    await expect(
      payload.create({
        collection: 'series',
        data: { title: `Série curta ${run}`, posts: [String(one.docs[0].id)] } as never,
      }),
    ).rejects.toThrow()
  })

  it('relacionados: post sem tags acha os da mesma categoria', async () => {
    const cat = await payload.find({
      collection: 'categories',
      where: { slug: { equals: 'diario' } },
      depth: 0,
    })
    const created = await payload.create({
      collection: 'posts',
      data: publishedData(`Diário sem tags ${run}`, { category: String(cat.docs[0].id) }),
    })
    cleanup.push({ collection: 'posts', id: String(created.id) })
    const related = await getRelatedPosts(created.slug!)
    expect(related.map((p) => p.slug)).toContain('diario-de-bordo-backup-que-funciona')
    expect(related.every((p) => p.category?.slug === 'diario')).toBe(true)
  })
})
