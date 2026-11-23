import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import {
  BLOG_PAGE_SIZE,
  FEATURED_MAX,
  getBlogPage,
  getDraftPost,
  getHomeData,
  getPublishedPost,
  getRelatedPosts,
  getSiteChrome,
} from '@/lib/queries'
import { setRevalidator } from '@/lib/revalidate'
import { seed } from '@/seed/seed'

let payload: Payload
const run = Date.now().toString(36)
let draftId: string | undefined

describe('dados do front (home, blog, header e footer)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    await seed(payload)
    const draft = await payload.create({
      collection: 'posts',
      draft: true,
      data: { title: `Rascunho do front ${run}`, featured: true, _status: 'draft' } as never,
    })
    draftId = String(draft.id)
  })
  afterAll(async () => {
    if (draftId) await payload.delete({ collection: 'posts', id: draftId }).catch(() => undefined)
    await payload.destroy()
  })

  it('home: até 3 destaques publicados e recentes do mais novo pro mais antigo', async () => {
    const { featured, recent, total } = await getHomeData()
    expect(featured.length).toBeGreaterThan(0)
    expect(featured.length).toBeLessThanOrEqual(FEATURED_MAX)
    expect(featured.map((p) => p.slug)).toContain('ia-local-no-homelab-sem-gpu')
    const dates = recent.map((p) => new Date(p.publishedAt).getTime())
    expect([...dates].sort((a, b) => b - a)).toEqual(dates)
    expect(total).toBeGreaterThanOrEqual(7)
    const all = [...featured, ...recent]
    expect(all.some((p) => p.title.includes(run))).toBe(false)
    const withCover = all.find((p) => p.slug === 'ia-local-no-homelab-sem-gpu')
    expect(withCover?.cover?.src).toMatch(/\.webp$/)
    expect(withCover?.cover?.alt).toBeTruthy()
    expect(withCover?.tags.map((t) => t.slug)).toEqual(['ia', 'homelab'])
    expect(withCover?.category?.slug).toBe('tutorial')
  })

  it('blog: pagina e não mostra rascunho', async () => {
    const first = await getBlogPage(1)
    expect(first.posts.length).toBeLessThanOrEqual(BLOG_PAGE_SIZE)
    expect(first.posts.some((p) => p.title.includes(run))).toBe(false)
    expect(first.totalPages).toBe(Math.max(1, Math.ceil(first.total / BLOG_PAGE_SIZE)))
    const beyond = await getBlogPage(first.totalPages + 1)
    expect(beyond.posts).toEqual([])
  })

  it('header e footer: navegação padrão e tags populares', async () => {
    const chrome = await getSiteChrome()
    expect(chrome.siteName).toBe('Pronto, Falei!')
    expect(chrome.header.map((i) => i.url)).toEqual(
      expect.arrayContaining(['/blog', '/arquivo', '/sobre']),
    )
    const slugs = chrome.popularTags.map((t) => t.slug)
    expect(slugs).toEqual(expect.arrayContaining(['ia', 'homelab', 'carreira']))
    const counts = chrome.popularTags.map((t) => t.count)
    expect([...counts].sort((a, b) => b - a)).toEqual(counts)
  })

  it('post: publicado com corpo rico, imagem populada e relacionados por tag', async () => {
    const post = await getPublishedPost('ia-local-no-homelab-sem-gpu')
    expect(post?.title).toBe('IA local no homelab, sem GPU e sem drama')
    const nodes = (post?.content as { root: { children: Record<string, unknown>[] } }).root.children
    const types = nodes.map((n) =>
      n.type === 'block' ? (n.fields as { blockType: string }).blockType : n.type,
    )
    expect(types).toEqual(
      expect.arrayContaining(['heading', 'list', 'code', 'callout', 'quote', 'embed', 'upload']),
    )
    const upload = nodes.find((n) => n.type === 'upload') as { value: { url?: string } }
    expect(typeof upload.value).toBe('object')
    expect(upload.value.url).toBeTruthy()

    const related = await getRelatedPosts('ia-local-no-homelab-sem-gpu')
    expect(related.length).toBeGreaterThan(0)
    expect(related.length).toBeLessThanOrEqual(3)
    expect(related.map((p) => p.slug)).not.toContain('ia-local-no-homelab-sem-gpu')
    for (const r of related) {
      expect(r.tags.some((t) => ['ia', 'homelab'].includes(t.slug))).toBe(true)
    }
    expect(await getPublishedPost('nao-existe')).toBeNull()
  })

  it('rascunho só aparece na pré-visualização (pelo slug ou pelo id)', async () => {
    expect(await getPublishedPost(`rascunho-do-front-${run}`)).toBeNull()
    const bySlug = await getDraftPost(`rascunho-do-front-${run}`)
    expect(bySlug?.title).toBe(`Rascunho do front ${run}`)
    const byId = await getDraftPost(draftId!)
    expect(byId?.id).toBe(draftId)
    expect(await getDraftPost('nada')).toBeNull()
  })

  it('salvar um post dispara o revalidateTag das listas e do post', async () => {
    const calls: string[] = []
    setRevalidator((t) => calls.push(t))
    try {
      await payload.update({
        collection: 'posts',
        id: draftId!,
        draft: true,
        data: { subtitle: `editado ${run}` } as never,
      })
    } finally {
      setRevalidator(null)
    }
    expect(calls).toEqual(['posts', 'feeds', `post:rascunho-do-front-${run}`])
  })
})
