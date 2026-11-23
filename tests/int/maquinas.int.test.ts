import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { lexicalFromBlocks } from '@/lib/lexicalBuilder'
import { blogPostingJsonLd, llmsTxt, postMarkdown, robotsTxt, rssXml } from '@/lib/machine'
import {
  getMachinePages,
  getMachinePost,
  getMachinePosts,
  getSiteInfo,
  getSitemapEntries,
} from '@/lib/queries'
import { seed } from '@/seed/seed'

let payload: Payload
const run = Date.now().toString(36)
let draftId: string | undefined

describe('leitura por máquinas (passo 7)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    await seed(payload)
  })
  afterAll(async () => {
    if (draftId) await payload.delete({ collection: 'posts', id: draftId }).catch(() => undefined)
    await payload.destroy()
  })

  it('site: nome, autor do SiteSettings, sameAs só com URLs e IA liberada', async () => {
    const site = await getSiteInfo()
    expect(site.name).toBe('Pronto, Falei!')
    expect(site.author.name).toBeTruthy()
    expect(site.author.sameAs.every((u) => /^https?:\/\//.test(u))).toBe(true)
    expect(site.aiRobots).toBe('allow')
    expect(robotsTxt(site)).toContain('User-agent: GPTBot\nAllow: /')
  })

  it('posts publicados com corpo, síntese e capa; .md e JSON-LD completos', async () => {
    const posts = await getMachinePosts(null)
    expect(posts.length).toBeGreaterThanOrEqual(7)
    const dates = posts.map((p) => p.publishedAt)
    expect([...dates].sort().reverse()).toEqual(dates)
    expect(posts.every((p) => p.summary.length >= 160 && p.keyPoints.length >= 3)).toBe(true)
    expect((await getMachinePosts(3)).length).toBe(3)

    const post = await getMachinePost('ia-local-no-homelab-sem-gpu')
    expect(post).not.toBeNull()
    const site = await getSiteInfo()
    const md = postMarkdown(post!, site)
    expect(md).toMatch(/^---\ntitle: /)
    expect(md).toContain('tags: [')
    expect(md).toContain('key_points:\n  - ')
    expect(md).toContain('llama')
    expect(md).not.toContain('[object Object]')
    const ld = blogPostingJsonLd(post!, site)
    expect(ld.wordCount).toBeGreaterThan(100)
    expect(ld.timeRequired).toMatch(/^PT\d+M$/)
    expect(String(ld.keywords)).toContain('Homelab')
    expect(await getMachinePost('nao-existe')).toBeNull()
  })

  it('rascunho não entra em .md, llms.txt, feeds nem sitemap', async () => {
    const created = await payload.create({
      collection: 'posts',
      draft: true,
      data: {
        title: `Rascunho das máquinas ${run}`,
        _status: 'draft',
        content: lexicalFromBlocks(['Texto secreto.']),
      } as never,
    })
    draftId = String(created.id)
    const slug = created.slug as string
    expect(await getMachinePost(slug)).toBeNull()
    const posts = await getMachinePosts(null)
    expect(posts.map((p) => p.slug)).not.toContain(slug)
    const site = await getSiteInfo()
    expect(llmsTxt(site, posts, [])).not.toContain(slug)
    expect(rssXml(site, posts)).not.toContain(slug)
    expect((await getSitemapEntries()).map((e) => e.path)).not.toContain(`/posts/${slug}`)
  })

  it('páginas publicadas e sitemap com lastmod real', async () => {
    const pages = await getMachinePages()
    const sobre = pages.find((p) => p.slug === 'sobre')
    expect(sobre?.title).toBeTruthy()
    const entries = await getSitemapEntries()
    const paths = entries.map((e) => e.path)
    expect(paths).toEqual(
      expect.arrayContaining([
        '/',
        '/blog',
        '/sobre',
        '/posts/ia-local-no-homelab-sem-gpu',
        '/tags/homelab',
      ]),
    )
    expect(new Set(paths).size).toBe(paths.length)
    const post = entries.find((e) => e.path === '/posts/ia-local-no-homelab-sem-gpu')
    expect(post?.lastmod && !Number.isNaN(Date.parse(post.lastmod))).toBe(true)
    const home = entries.find((e) => e.path === '/')
    const newest = entries
      .filter((e) => e.path.startsWith('/posts/'))
      .map((e) => e.lastmod!)
      .sort()
      .at(-1)
    expect(home?.lastmod).toBe(newest)
  })
})
