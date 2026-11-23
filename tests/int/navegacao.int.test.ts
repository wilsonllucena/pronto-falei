import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { lexicalFromBlocks } from '@/lib/lexicalBuilder'
import {
  findRedirect,
  getAboutData,
  getAllCategories,
  getAllTags,
  getArchive,
  getCategoryPage,
  getPublishedPage,
  getTagPage,
  searchPosts,
} from '@/lib/queries'
import { setRevalidator } from '@/lib/revalidate'
import { ensureSearchTextIndex } from '@/plugins/search'
import { seed } from '@/seed/seed'

let payload: Payload
const run = Date.now().toString(36)
const word = `zebralho${run}`
let postId: string | undefined
let redirectId: string | undefined

const hits = (segs: { text: string; hit: boolean }[]) =>
  segs.filter((s) => s.hit).map((s) => s.text)

describe('navegação e páginas (passo 6)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    await seed(payload)
    await ensureSearchTextIndex(payload)
  })
  afterAll(async () => {
    if (postId) await payload.delete({ collection: 'posts', id: postId }).catch(() => undefined)
    if (redirectId)
      await payload.delete({ collection: 'redirects', id: redirectId }).catch(() => undefined)
    await payload.destroy()
  })

  it('índice de texto em português existe e é idempotente', async () => {
    await ensureSearchTextIndex(payload)
    const col = (
      payload.db as unknown as {
        collections: Record<
          string,
          { collection: { indexes: () => Promise<Record<string, unknown>[]> } }
        >
      }
    ).collections.search.collection
    const text = (await col.indexes()).filter((i) => (i.key as { _fts?: string })._fts === 'text')
    expect(text).toHaveLength(1)
    expect(text[0].name).toBe('busca_texto_pt')
    expect(text[0].default_language).toBe('portuguese')
  })

  it('busca: posts do seed indexados com corpo e tags', async () => {
    const doc = (
      await payload.find({
        collection: 'search',
        where: { slug: { equals: 'ia-local-no-homelab-sem-gpu' } },
        limit: 1,
      })
    ).docs[0] as unknown as { body: string; tagNames: string; summary: string }
    expect(doc.body).toContain('llama')
    expect(doc.tagNames).toContain('homelab')
    expect(doc.summary.length).toBeGreaterThan(50)
  })

  it('busca: acha por palavra, radical e sem acento, com destaque', async () => {
    const r = await searchPosts('homelab')
    expect(r.total).toBeGreaterThan(0)
    expect(r.results.map((x) => x.slug)).toContain('ia-local-no-homelab-sem-gpu')
    const top = r.results.find((x) => x.slug === 'ia-local-no-homelab-sem-gpu')!
    expect(hits(top.title).map((h) => h.toLowerCase())).toContain('homelab')
    expect(top.snippet.some((s) => s.hit)).toBe(true)

    // radical: "modelos" acha texto com "modelo"
    const stem = await searchPosts('modelos')
    expect(stem.results.map((x) => x.slug)).toContain('ia-local-no-homelab-sem-gpu')
    // pedaço de palavra cai na busca parcial
    const partial = await searchPosts('homela')
    expect(partial.results.map((x) => x.slug)).toContain('ia-local-no-homelab-sem-gpu')
    expect(await searchPosts('   ')).toMatchObject({ total: 0, results: [] })
    expect((await searchPosts('xyzzyquaseimpossivel')).total).toBe(0)
  })

  it('busca: publicado entra, despublicado sai do índice', async () => {
    const created = await payload.create({
      collection: 'posts',
      data: {
        title: `Post da busca ${run}`,
        _status: 'published',
        publishedAt: '2026-01-15T12:00:00.000Z',
        content: lexicalFromBlocks([`Um parágrafo com a palavra ${word} no meio do texto.`]),
        summary: `Síntese do teste de integração da busca, com texto suficiente pra passar na validação de tamanho mínimo da síntese do post. Ela precisa ter entre 160 e 400 caracteres, então vai mais uma frase ${run}.`,
        keyPoints: [{ text: 'Um' }, { text: 'Dois' }, { text: 'Três' }],
        summarySource: 'manual',
      } as never,
    })
    postId = String(created.id)
    const found = await searchPosts(word)
    expect(found.results.map((r) => r.slug)).toEqual([created.slug])
    expect(hits(found.results[0].snippet)).toEqual([word])

    await payload.update({
      collection: 'posts',
      id: postId,
      data: { _status: 'draft' } as never,
    })
    expect((await searchPosts(word)).total).toBe(0)
  })

  it('tags e categorias: contagem só de publicados e páginas com posts', async () => {
    const tags = await getAllTags()
    expect(tags.map((t) => t.slug)).toEqual(expect.arrayContaining(['ia', 'homelab', 'carreira']))
    const counts = tags.map((t) => t.count)
    expect([...counts].sort((a, b) => b - a)).toEqual(counts)
    const homelab = await getTagPage('homelab')
    expect(homelab?.description).toContain('Servidor em casa')
    expect(homelab?.posts.length).toBe(tags.find((t) => t.slug === 'homelab')?.count)
    expect(homelab?.posts.every((p) => p.tags.some((t) => t.slug === 'homelab'))).toBe(true)
    expect(await getTagPage('nao-existe')).toBeNull()

    const cats = await getAllCategories()
    expect(cats.map((c) => c.slug)).toEqual(
      expect.arrayContaining(['opiniao', 'tutorial', 'diario']),
    )
    const tutorial = await getCategoryPage('tutorial')
    expect(tutorial?.color).toBe('#1971C2')
    expect(tutorial?.posts.every((p) => p.category?.slug === 'tutorial')).toBe(true)
    expect(tutorial?.posts.length).toBe(cats.find((c) => c.slug === 'tutorial')?.count)
  })

  it('arquivo: tudo publicado, do mais novo pro mais antigo, com filtro', async () => {
    const all = await getArchive(null)
    expect(all.length).toBeGreaterThanOrEqual(7)
    const dates = all.map((p) => new Date(p.publishedAt).getTime())
    expect([...dates].sort((a, b) => b - a)).toEqual(dates)
    expect(all.some((p) => p.title.includes(run))).toBe(false)
    const diario = await getArchive('diario')
    expect(diario.length).toBeGreaterThan(0)
    expect(diario.every((p) => p.category?.slug === 'diario')).toBe(true)
  })

  it('sobre: página publicada e autor com padrão', async () => {
    const { page, author } = await getAboutData()
    expect(page?.slug).toBe('sobre')
    expect(author.name).toBe('Wilson Lima')
    expect(author.role).toContain('fullstack')
    expect(await getPublishedPage('sobre')).not.toBeNull()
    expect(await getPublishedPage('nao-existe')).toBeNull()
  })

  it('redirecionamentos: caminho normalizado ao salvar e destino resolvido', async () => {
    expect(await findRedirect('/2026/ola-mundo')).toEqual({
      to: '/posts/ola-mundo-pronto-falei',
      permanent: true,
    })
    expect(await findRedirect('/2026/OLA-MUNDO/')).toEqual({
      to: '/posts/ola-mundo-pronto-falei',
      permanent: true,
    })
    expect(await findRedirect('/nada-aqui')).toBeNull()

    const calls: string[] = []
    setRevalidator((t) => calls.push(t))
    try {
      const r = await payload.create({
        collection: 'redirects',
        data: {
          from: `https://exemplo.dev/Velho-${run}/`,
          type: '302',
          to: { type: 'custom', url: '/sobre' },
        },
      })
      redirectId = String(r.id)
      expect(r.from).toBe(`/velho-${run}`)
    } finally {
      setRevalidator(null)
    }
    expect(calls).toEqual(['redirects'])
    expect(await findRedirect(`/velho-${run}`)).toEqual({ to: '/sobre', permanent: false })
  })

  it('salvar uma página invalida páginas e feeds', async () => {
    const calls: string[] = []
    setRevalidator((t) => calls.push(t))
    try {
      const sobre = (
        await payload.find({ collection: 'pages', where: { slug: { equals: 'sobre' } } })
      ).docs[0]
      await payload.update({ collection: 'pages', id: sobre.id, data: { title: 'Sobre' } })
    } finally {
      setRevalidator(null)
    }
    expect(calls).toEqual(['pages', 'feeds'])
  })
})
