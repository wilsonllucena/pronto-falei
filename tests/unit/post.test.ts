import { afterEach, describe, expect, it, vi } from 'vitest'

import { Categories } from '@/collections/Categories'
import { Media } from '@/collections/Media'
import { Posts, previewPath, requestOrigin } from '@/collections/Posts'
import { Tags } from '@/collections/Tags'
import { Navigation } from '@/globals/Navigation'
import { SiteSettings } from '@/globals/SiteSettings'
import { CACHE_TAGS, postChangeTags } from '@/lib/cacheTags'
import { highlight, shikiLang } from '@/lib/highlight'
import { lexicalFromBlocks } from '@/lib/lexicalBuilder'
import {
  absoluteUrl,
  parseEmbed,
  pickRelated,
  siteUrl,
  summarizeWithAiLinks,
  withHeadingAnchors,
} from '@/lib/post'
import {
  revalidatePostAfterChange,
  revalidatePostAfterDelete,
  revalidateSiteAfterChange,
  setRevalidator,
} from '@/lib/revalidate'
import type { Post } from '@/payload-types'

describe('índice e âncoras', () => {
  it('dá ids únicos aos h2/h3 sem mexer no original', () => {
    const content = lexicalFromBlocks([
      { heading: 'Por que um modelo pequeno' },
      'texto',
      { heading: 'Números do teste', tag: 'h3' },
      { heading: 'Conclusão' },
      { heading: 'Conclusão' },
    ])
    const { content: out, toc } = withHeadingAnchors(content)
    expect(toc).toEqual([
      { id: 'por-que-um-modelo-pequeno', text: 'Por que um modelo pequeno', level: 2 },
      { id: 'numeros-do-teste', text: 'Números do teste', level: 3 },
      { id: 'conclusao', text: 'Conclusão', level: 2 },
      { id: 'conclusao-2', text: 'Conclusão', level: 2 },
    ])
    const nodes = (out as { root: { children: Record<string, unknown>[] } }).root.children
    expect(nodes[0].anchorId).toBe('por-que-um-modelo-pequeno')
    expect(JSON.stringify(content)).not.toContain('anchorId')
    expect(withHeadingAnchors(null).toc).toEqual([])
  })
})

const tag = (id: string) => ({ id, name: id, slug: id }) as never
const post = (id: string, tags: string[], publishedAt: string, extra: Partial<Post> = {}) =>
  ({ id, tags: tags.map(tag), publishedAt, _status: 'published', ...extra }) as Post

describe('posts relacionados', () => {
  const current = post('p0', ['ia', 'homelab'], '2026-11-20')
  const pool = [
    post('p1', ['ia'], '2026-11-01'),
    post('p2', ['ia', 'homelab'], '2026-09-01'),
    post('p3', ['carreira'], '2026-11-19'),
    post('p4', ['homelab'], '2026-11-10'),
    post('p0', ['ia', 'homelab'], '2026-11-20'),
  ]

  it('ordena por tags em comum e depois pelos mais novos, sem o próprio post', () => {
    expect(pickRelated(current, pool).map((p) => p.id)).toEqual(['p2', 'p4', 'p1'])
    expect(pickRelated(current, pool, 1).map((p) => p.id)).toEqual(['p2'])
  })

  it('o override manual vence, só com os publicados', () => {
    const manual = {
      ...current,
      relatedPosts: [
        post('p3', [], '2026-01-01'),
        post('p9', [], '2026-01-01', { _status: 'draft' }),
        'id-solto',
      ],
    } as Post
    expect(pickRelated(manual, pool).map((p) => p.id)).toEqual(['p3'])
  })
})

describe('resumir com IA, embeds e URLs', () => {
  it('monta os links com a URL do .md', () => {
    const links = summarizeWithAiLinks('https://blog.test/posts/x.md')
    expect(links.map((l) => l.label)).toEqual(['Grok', 'ChatGPT', 'Claude'])
    for (const l of links)
      expect(decodeURIComponent(l.href)).toContain('https://blog.test/posts/x.md')
    expect(links[2].href).toMatch(/^https:\/\/claude\.ai\/new\?q=/)
  })

  it('reconhece YouTube (sem cookies) e X (cartão sem JS)', () => {
    expect(parseEmbed('https://www.youtube.com/watch?v=abcDEF12345')).toEqual({
      kind: 'youtube',
      id: 'abcDEF12345',
      src: 'https://www.youtube-nocookie.com/embed/abcDEF12345',
    })
    expect(parseEmbed('https://youtu.be/abcDEF12345?t=3').kind).toBe('youtube')
    expect(parseEmbed('https://youtube.com/shorts/abcDEF12345').kind).toBe('youtube')
    expect(parseEmbed('https://x.com/ggml_org/status/123')).toEqual({
      kind: 'x',
      url: 'https://x.com/ggml_org/status/123',
      handle: 'ggml_org',
      isPost: true,
    })
    expect(parseEmbed('https://twitter.com/ggml_org')).toMatchObject({ kind: 'x', isPost: false })
    expect(parseEmbed('https://youtube.com/watch?v=<script>').kind).toBe('link')
    expect(parseEmbed('não é url')).toEqual({ kind: 'link', url: 'não é url' })
  })

  it('URL do site vem do ambiente em runtime', () => {
    expect(siteUrl({ NEXT_PUBLIC_SERVER_URL: 'https://blog.test/' })).toBe('https://blog.test')
    expect(siteUrl({})).toBe('http://localhost:3130')
    expect(absoluteUrl('posts/a', 'https://blog.test/')).toBe('https://blog.test/posts/a')
  })
})

describe('pré-visualização e live preview', () => {
  it('aponta pro post com ?preview=1, pelo slug ou pelo id', () => {
    expect(previewPath({ slug: 'meu-post', id: 'x' })).toBe('/posts/meu-post?preview=1')
    expect(previewPath({ id: '65f0' })).toBe('/posts/65f0?preview=1')
  })

  it('usa a origem da requisição (proxy incluso) e valida o host', () => {
    expect(requestOrigin(new Headers({ host: '192.168.1.18:3130' }))).toBe(
      'http://192.168.1.18:3130',
    )
    expect(
      requestOrigin(
        new Headers({
          host: 'app:3000',
          'x-forwarded-host': 'blog.test',
          'x-forwarded-proto': 'https',
        }),
      ),
    ).toBe('https://blog.test')
    expect(requestOrigin(new Headers({ host: 'evil.test/"><script>' }))).toBe(siteUrl())
    expect(requestOrigin(undefined)).toBe(siteUrl())
  })

  it('Posts tem preview e live preview com celular, tablet e desktop', () => {
    expect(typeof Posts.admin?.preview).toBe('function')
    const lp = Posts.admin?.livePreview
    expect(lp?.breakpoints?.map((b) => b.name)).toEqual(['mobile', 'tablet', 'desktop'])
  })
})

describe('ISR sob demanda (revalidateTag)', () => {
  afterEach(() => setRevalidator(null))

  it('post: invalida listas, feeds, o post e o slug antigo', async () => {
    expect(postChangeTags({ slug: 'novo' }, { slug: 'velho' })).toEqual([
      'posts',
      'feeds',
      'post:novo',
      'post:velho',
    ])
    const calls: string[] = []
    setRevalidator((t) => calls.push(t))
    const args = { doc: { slug: 'a' }, previousDoc: { slug: 'a' }, context: {} } as never
    await revalidatePostAfterChange(args)
    expect(calls).toEqual(['posts', 'feeds', 'post:a'])
    calls.length = 0
    await revalidatePostAfterDelete({ doc: { slug: 'b' }, context: {} } as never)
    expect(calls).toEqual(['posts', 'feeds', 'post:b'])
    calls.length = 0
    await revalidatePostAfterChange({
      ...(args as object),
      context: { disableRevalidate: true },
    } as never)
    expect(calls).toEqual([])
  })

  it('globals invalidam o site; tags, categorias e mídias invalidam as listas', async () => {
    const calls: string[] = []
    setRevalidator((t) => calls.push(t))
    await revalidateSiteAfterChange({ doc: {}, context: {} } as never)
    expect(calls).toEqual([CACHE_TAGS.site, CACHE_TAGS.feeds])
    for (const c of [Tags, Categories, Media]) {
      expect(c.hooks?.afterChange?.length).toBe(1)
      expect(c.hooks?.afterDelete?.length).toBe(1)
    }
    for (const g of [SiteSettings, Navigation]) expect(g.hooks?.afterChange?.length).toBe(1)
    expect(Posts.hooks?.afterChange?.length).toBe(1)
  })

  it('fora do servidor Next é um no-op', async () => {
    const spy = vi.spyOn(console, 'warn')
    await revalidatePostAfterChange({ doc: { slug: 'a' }, context: {} } as never)
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('Shiki', () => {
  it('realça com os temas claro e escuro em variáveis CSS', async () => {
    const html = await highlight('const a: number = 1', 'typescript')
    expect(html).toContain('class="shiki shiki-themes github-light github-dark"')
    expect(html).toContain('--shiki-light:')
    expect(html).toContain('--shiki-dark:')
  })

  it('escapa HTML e cai pra texto puro em linguagem desconhecida', async () => {
    expect(shikiLang('cobol')).toBe('text')
    expect(shikiLang(undefined)).toBe('text')
    expect(shikiLang('dockerfile')).toBe('dockerfile')
    const html = await highlight('<script>alert(1)</script>', 'cobol')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&#x3C;script>')
  })
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- nós Lexical soltos no teste
type Node = Record<string, any>

describe('lexicalBuilder com blocos', () => {
  it('gera listas, links, formatos, blocos e imagem', () => {
    const { root } = lexicalFromBlocks([
      {
        paragraph: [
          'a ',
          { text: 'b', bold: true },
          { text: 'c', code: true },
          { text: 'd', href: 'https://x.test' },
        ],
      },
      { list: [['um'], ['dois']], ordered: true },
      { code: 'ls', language: 'bash', title: 'shell' },
      { callout: 'oi', tone: 'dica' },
      { quote: 'q', author: 'eu' },
      { embed: 'https://x.com/a' },
      { image: '65f000000000000000000000', caption: 'leg' },
    ])
    const [p, list, code, callout, quote, embed, image] = root.children as Node[]
    expect(p.children.map((c: Node) => (c.type === 'link' ? 'link' : c.format))).toEqual([
      0,
      1,
      16,
      'link',
    ])
    expect(list).toMatchObject({ type: 'list', listType: 'number', tag: 'ol' })
    expect(code.fields).toMatchObject({
      blockType: 'code',
      code: 'ls',
      language: 'bash',
      title: 'shell',
    })
    expect(code.fields.id).toMatch(/^[0-9a-f]{24}$/)
    expect(callout.fields).toMatchObject({ blockType: 'callout', tone: 'dica' })
    expect(quote.fields).toMatchObject({ blockType: 'quote', author: 'eu' })
    expect(embed.fields).toMatchObject({ blockType: 'embed', url: 'https://x.com/a' })
    expect(image).toMatchObject({ type: 'upload', relationTo: 'media', fields: { caption: 'leg' } })
  })
})
