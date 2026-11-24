import path from 'node:path'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { importContent, loadContent, type ContentApi } from '../../scripts/import-content'

let payload: Payload
const run = Date.now().toString(36)
const content = loadContent(path.resolve(__dirname, '../../content'))
// Série com slug/título próprios: o seed de dev já tem uma "Homelab do zero".
const seriesSlug = `homelab-do-zero-${run}`
content.taxonomy.series = content.taxonomy.series.map((s) => ({
  ...s,
  slug: seriesSlug,
  titulo: `${s.titulo} ${run}`,
}))
content.articles = content.articles.map((a) => (a.serie ? { ...a, serie: seriesSlug } : a))
const slugs = content.articles.map((a) => a.slug)
const alts = content.taxonomy.capas.map((c) => c.alt)
let mediaBefore = new Set<string>()

/** A mesma interface da importação, pela Local API (sem HTTP). */
const localApi = (): ContentApi => ({
  async findOne(collection, field, value) {
    const r = await payload.find({
      collection,
      where: { [field]: { equals: value } },
      limit: 1,
      depth: 0,
      draft: true,
    })
    return (r.docs[0] as never) ?? null
  },
  create: (collection, data, opts) =>
    payload.create({ collection, data: data as never, draft: opts?.draft, depth: 0 }) as never,
  update: (collection, id, data, opts) =>
    payload.update({ collection, id, data: data as never, draft: opts?.draft, depth: 0 }) as never,
  upload: (alt, file) =>
    payload.create({
      collection: 'media',
      data: { alt, credit: 'Ilustração do blog' },
      file: { data: file.data, mimetype: file.mimetype, name: file.name, size: file.data.length },
    }) as never,
})

async function cleanup() {
  await payload.delete({ collection: 'series', where: { slug: { equals: seriesSlug } } })
  await payload.delete({ collection: 'posts', where: { slug: { in: slugs } } })
  const media = await payload.find({
    collection: 'media',
    where: { alt: { in: alts } },
    limit: 50,
    depth: 0,
  })
  for (const m of media.docs)
    if (!mediaBefore.has(String(m.id))) await payload.delete({ collection: 'media', id: m.id })
}

describe('import-content (artigos de lançamento)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    await payload.delete({ collection: 'posts', where: { slug: { in: slugs } } })
    const media = await payload.find({
      collection: 'media',
      where: { alt: { in: alts } },
      limit: 50,
      depth: 0,
    })
    mediaBefore = new Set(media.docs.map((m) => String(m.id)))
  })
  afterAll(async () => {
    await cleanup()
    await payload.destroy()
  })

  it('cria tudo como rascunho por padrão e é idempotente', async () => {
    const first = await importContent(localApi(), content)
    expect(first.published).toEqual([])
    expect(first.created).toEqual(expect.arrayContaining(slugs.map((s) => `post ${s}`)))
    expect(first.created).toContain(`série ${seriesSlug}`)

    const posts = await payload.find({
      collection: 'posts',
      where: { slug: { in: slugs } },
      draft: true,
      limit: 20,
    })
    expect(posts.totalDocs).toBe(7)
    for (const p of posts.docs) expect(p._status).toBe('draft')
    // rascunho não aparece pra visitante
    const publicView = await payload.find({
      collection: 'posts',
      where: { slug: { in: slugs } },
      overrideAccess: false,
    })
    expect(publicView.totalDocs).toBe(0)

    const second = await importContent(localApi(), content)
    expect(second.created).toEqual([])
    expect(second.skipped.sort()).toEqual([...slugs].sort())
  })

  it('--publicar publica os rascunhos com síntese, capa, tags e série em ordem', async () => {
    const now = new Date('2026-11-24T12:00:00.000Z')
    const r = await importContent(localApi(), content, { publish: true, now })
    expect(r.published.sort()).toEqual([...slugs].sort())

    const posts = await payload.find({
      collection: 'posts',
      where: { slug: { in: slugs } },
      overrideAccess: false,
      depth: 1,
      limit: 20,
      sort: '-publishedAt',
    })
    expect(posts.totalDocs).toBe(7)
    const bySlug = Object.fromEntries(posts.docs.map((p) => [p.slug, p]))
    const ia = bySlug['ia-local-leve-so-texto-llama-cpp']
    expect(ia._status).toBe('published')
    expect(ia.summarySource).toBe('manual')
    expect(ia.keyPoints?.length).toBeGreaterThanOrEqual(3)
    expect(ia.wordCount).toBeGreaterThan(800)
    expect(typeof ia.cover === 'object' && ia.cover?.alt).toMatch(/verde/)
    expect((ia.tags ?? []).map((t) => (typeof t === 'object' ? t.slug : t))).toEqual([
      'ia',
      'homelab',
      'docker',
    ])
    expect(posts.docs[0].slug).toBe('ia-local-leve-so-texto-llama-cpp') // ordem 1 = mais recente
    expect(ia.publishedAt).toBe(now.toISOString())

    const series = await payload.find({
      collection: 'series',
      where: { slug: { equals: seriesSlug } },
      depth: 1,
    })
    expect((series.docs[0].posts ?? []).map((p) => (typeof p === 'object' ? p.slug : p))).toEqual([
      'homelab-do-zero-umbrel-docker-cloudflare-tunnel',
      'backup-que-voce-testou-com-restore',
      'ia-local-leve-so-texto-llama-cpp',
    ])

    const again = await importContent(localApi(), content, { publish: true })
    expect(again.published).toEqual([])
    expect(again.created).toEqual([])
  })
})
