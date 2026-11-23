import { describe, expect, it } from 'vitest'

import { lexicalFromBlocks } from '@/lib/lexicalBuilder'
import {
  AI_BOTS,
  atomXml,
  blogPostingJsonLd,
  isoDate,
  jsonFeed,
  jsonLdString,
  llmsFullTxt,
  llmsTxt,
  type MachinePost,
  pageMarkdown,
  postMarkdown,
  robotsTxt,
  rssXml,
  type SiteInfo,
  sitemapXml,
  websiteJsonLd,
} from '@/lib/machine'
import { lexicalToHtml, lexicalToMarkdown } from '@/lib/serialize'

const absolute = (p: string) => `https://blog.test${p}`
const o = { absolute }

const site: SiteInfo = {
  name: 'Pronto, Falei!',
  tagline: 'Ideias, sem rodeios.',
  url: 'https://blog.test',
  author: { name: 'Wilson Lima', url: 'https://blog.test/sobre', sameAs: ['https://github.com/x'] },
  llmsIntro: null,
  aiRobots: 'allow',
}

const content = lexicalFromBlocks([
  { heading: 'Por que' },
  {
    paragraph: [
      'Texto com ',
      { text: 'negrito', bold: true },
      ', ',
      { text: 'itálico', italic: true },
      ', ',
      { text: 'llama.cpp', code: true },
      ' e ',
      { text: 'link', href: 'https://github.com/ggml-org/llama.cpp' },
      ' e ',
      { text: 'interno', href: '/posts/outro' },
      '.',
    ],
  },
  { list: [['um'], ['dois']] },
  { list: [['primeiro'], ['segundo']], ordered: true },
  { code: 'echo "oi"\n```dentro```', language: 'bash', title: 'run.sh' },
  { callout: 'Use Q3_K_M.', tone: 'dica', title: 'Modelo' },
  { quote: 'Simples vence.', author: 'Alguém', sourceUrl: 'https://exemplo.com' },
  { embed: 'https://youtu.be/dQw4w9WgXcQ', caption: 'vídeo' },
  { embed: 'https://x.com/ggml_org' },
  'Fim <script>alert(1)</script> & tal.',
])

const post: MachinePost = {
  slug: 'ia-local',
  title: 'IA local: "sem GPU"',
  subtitle: 'Um 4B na CPU',
  summary: 'Rodei um modelo pequeno na CPU do homelab.',
  keyPoints: ['Cabe em 3 GB', 'Não sai da rede'],
  publishedAt: '2026-11-20T12:00:00.000Z',
  updatedAt: '2026-11-21T02:30:00.000Z',
  tags: [
    { name: 'IA', slug: 'ia' },
    { name: 'Homelab', slug: 'homelab' },
  ],
  category: { name: 'Tutorial', slug: 'tutorial' },
  readingTime: 7,
  wordCount: 1400,
  content,
  cover: { url: '/api/media/file/capa-og.webp', width: 1200, height: 630, alt: 'Capa' },
}

describe('Lexical → Markdown', () => {
  const md = lexicalToMarkdown(content, o)

  it('títulos, formatos, links (internos viram absolutos) e listas', () => {
    expect(md).toContain('## Por que')
    expect(md).toContain(
      'Texto com **negrito**, _itálico_, `llama.cpp` e [link](https://github.com/ggml-org/llama.cpp) e [interno](https://blog.test/posts/outro).',
    )
    expect(md).toContain('- um\n- dois')
    expect(md).toContain('1. primeiro\n2. segundo')
  })

  it('código com cerca maior que a do conteúdo, destaque, citação e embeds', () => {
    expect(md).toContain('run.sh:\n\n````bash\necho "oi"\n```dentro```\n````')
    expect(md).toContain('> **Dica: Modelo**\n> Use Q3_K_M.')
    expect(md).toContain('> Simples vence.\n>\n> — [Alguém](https://exemplo.com)')
    expect(md).toContain('[Vídeo no YouTube](https://www.youtube.com/watch?v=dQw4w9WgXcQ) — vídeo')
    expect(md).toContain('[Post no X](https://x.com/ggml_org)')
    expect(md).toContain('Fim \\<script\\>alert(1)\\</script\\> & tal.')
  })

  it('imagem com URL absoluta e legenda; link perigoso vira texto', () => {
    const state = {
      root: {
        children: [
          {
            type: 'upload',
            value: { url: '/api/media/file/a.webp', alt: 'Gráfico' },
            fields: { caption: 'Fila' },
          },
          {
            type: 'paragraph',
            children: [
              {
                type: 'link',
                fields: { url: 'javascript:alert(1)' },
                children: [{ type: 'text', text: 'clique' }],
              },
            ],
          },
          {
            type: 'list',
            listType: 'check',
            children: [
              { type: 'listitem', checked: true, children: [{ type: 'text', text: 'feito' }] },
              {
                type: 'listitem',
                children: [
                  { type: 'text', text: 'pai' },
                  {
                    type: 'list',
                    listType: 'bullet',
                    children: [{ type: 'listitem', children: [{ type: 'text', text: 'filho' }] }],
                  },
                ],
              },
            ],
          },
        ],
      },
    }
    const out = lexicalToMarkdown(state, o)
    expect(out).toContain('![Gráfico](https://blog.test/api/media/file/a.webp)\n_Fila_')
    expect(out).toContain('\n\nclique\n\n')
    expect(out).toContain('- [x] feito\n- [ ] pai\n  - filho')
    expect(lexicalToMarkdown(null, o)).toBe('')
  })
})

describe('Lexical → HTML', () => {
  const html = lexicalToHtml(content, o)
  it('escapa texto e atributos e mantém a estrutura', () => {
    expect(html).toContain('<h2>Por que</h2>')
    expect(html).toContain('<strong>negrito</strong>')
    expect(html).toContain('<a href="https://blog.test/posts/outro">interno</a>')
    expect(html).toContain('<ol><li>primeiro</li><li>segundo</li></ol>')
    expect(html).toContain('<code class="language-bash">echo &quot;oi&quot;')
    expect(html).toContain('Fim &lt;script&gt;alert(1)&lt;/script&gt; &amp; tal.')
    expect(html).not.toContain('<script')
  })
})

describe('post em Markdown e llms.txt', () => {
  it('frontmatter com datas no fuso do site, tags, summary e key_points', () => {
    const md = postMarkdown(post, site)
    expect(md.startsWith('---\ntitle: "IA local: \\"sem GPU\\""\n')).toBe(true)
    expect(md).toContain('url: https://blog.test/posts/ia-local\n')
    expect(md).toContain('published: 2026-11-20\n')
    // 02:30 UTC do dia 21 ainda é dia 20 em Brasília
    expect(md).toContain('updated: 2026-11-20\n')
    expect(md).toContain('tags: ["ia", "homelab"]\n')
    expect(md).toContain('reading_time: "7 min"\n')
    expect(md).toContain('key_points:\n  - "Cabe em 3 GB"\n  - "Não sai da rede"\n---')
    expect(md).toContain('# IA local: "sem GPU"\n\n_Um 4B na CPU_\n\n> Rodei um modelo')
    expect(md).toContain('**Pontos-chave**\n\n- Cabe em 3 GB')
    expect(md).toContain('## Por que')
    expect(md).not.toMatch(/\n{3,}/)
    expect(isoDate('2026-01-01T02:00:00Z')).toBe('2025-12-31')
  })

  it('página em Markdown', () => {
    const md = pageMarkdown(
      {
        slug: 'sobre',
        title: 'Sobre',
        description: 'Quem escreve',
        updatedAt: post.updatedAt,
        content,
      },
      site,
    )
    expect(md).toContain('url: https://blog.test/sobre\n')
    expect(md).toContain('description: "Quem escreve"')
    expect(md).toContain('# Sobre\n\n## Por que')
  })

  it('llms.txt no padrão llmstxt.org e llms-full com todos os posts', () => {
    const txt = llmsTxt(
      site,
      [post],
      [
        {
          slug: 'sobre',
          title: 'Sobre',
          description: 'Quem escreve',
          updatedAt: '',
          content: null,
        },
      ],
    )
    expect(txt.startsWith('# Pronto, Falei!\n\n> Blog do Wilson Lima')).toBe(true)
    expect(txt).toContain(
      '## Posts\n- [IA local: "sem GPU"](https://blog.test/posts/ia-local.md): Rodei um modelo pequeno na CPU do homelab.',
    )
    expect(txt).toContain('## Páginas\n- [Sobre](https://blog.test/sobre.md): Quem escreve')
    expect(txt).toContain('[Todos os textos completos](https://blog.test/llms-full.txt)')
    expect(llmsTxt({ ...site, llmsIntro: 'Linha 1\nLinha 2' }, [], [])).toContain(
      '> Linha 1\n> Linha 2',
    )
    const full = llmsFullTxt(site, [post, { ...post, slug: 'outro', title: 'Outro' }])
    expect(full).toContain('2 posts publicados')
    // cabeçalho + 2 posts, cada um abrindo com o próprio frontmatter
    expect(full.split('\n---\n\n---\n').length).toBe(3)
    expect(full).toContain('# Outro')
  })
})

describe('feeds', () => {
  it('RSS 2.0: description = summary e content:encoded = texto completo', () => {
    const xml = rssXml(site, [post])
    expect(xml).toContain('<rss version="2.0"')
    expect(xml).toContain('<title>IA local: &quot;sem GPU&quot;</title>')
    expect(xml).toContain('<description>Rodei um modelo pequeno na CPU do homelab.</description>')
    expect(xml).toContain('<content:encoded><![CDATA[')
    expect(xml).toContain('<h2>Por que</h2>')
    expect(xml).toContain('<guid isPermaLink="true">https://blog.test/posts/ia-local</guid>')
    expect(xml).toContain('<atom:link href="https://blog.test/rss.xml" rel="self"')
    expect(xml).toContain('src="https://blog.test/api/media/file/capa-og.webp"')
  })

  it('CDATA não quebra com "]]>" no texto', () => {
    const tricky = {
      ...post,
      content: lexicalFromBlocks([{ code: 'a]]>b', language: 'ts' }]),
    }
    const xml = rssXml(site, [tricky])
    expect(xml).toContain('a]]&gt;b')
    expect(xml.match(/]]>/g)?.length).toBe(1)
  })

  it('Atom e JSON Feed', () => {
    const atom = atomXml(site, [post])
    expect(atom).toContain('<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="pt-BR">')
    expect(atom).toContain('type="text/markdown" href="https://blog.test/posts/ia-local.md"')
    expect(atom).toContain('<content type="html">&lt;p&gt;')
    const json = jsonFeed(site, [post])
    expect(json.version).toBe('https://jsonfeed.org/version/1.1')
    expect(json.items[0]).toMatchObject({
      id: 'https://blog.test/posts/ia-local',
      summary: post.summary,
      tags: ['IA', 'Homelab'],
      _markdown_url: 'https://blog.test/posts/ia-local.md',
    })
    expect(json.items[0].content_html).toContain('<h2>Por que</h2>')
  })
})

describe('JSON-LD', () => {
  it('BlogPosting com abstract, wordCount, timeRequired, keywords e autor', () => {
    const ld = blogPostingJsonLd(post, site)
    expect(ld).toMatchObject({
      '@type': 'BlogPosting',
      headline: post.title,
      abstract: post.summary,
      description: post.summary,
      keywords: 'IA, Homelab',
      articleSection: 'Tutorial',
      wordCount: 1400,
      timeRequired: 'PT7M',
      inLanguage: 'pt-BR',
      datePublished: '2026-11-20T12:00:00.000Z',
      image: 'https://blog.test/api/media/file/capa-og.webp',
      author: { '@type': 'Person', name: 'Wilson Lima', sameAs: ['https://github.com/x'] },
    })
    expect(blogPostingJsonLd({ ...post, cover: null }, site).image).toBe(
      'https://blog.test/posts/ia-local/opengraph-image',
    )
    expect(websiteJsonLd(site).potentialAction.target.urlTemplate).toBe(
      'https://blog.test/busca?q={search_term_string}',
    )
  })

  it('não deixa fechar a tag <script>', () => {
    expect(jsonLdString({ a: '</script><b>' })).toBe('{"a":"\\u003c/script>\\u003cb>"}')
  })
})

describe('robots.txt e sitemap', () => {
  it('libera os robôs de IA, esconde admin e aponta o sitemap', () => {
    const txt = robotsTxt(site)
    expect(txt).toContain('User-agent: *\nAllow: /\nDisallow: /admin')
    for (const bot of ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended'])
      expect(txt).toContain(`User-agent: ${bot}\nAllow: /`)
    expect(txt).toContain('Sitemap: https://blog.test/sitemap.xml')
    expect(AI_BOTS.length).toBeGreaterThan(10)
  })

  it('bloqueia os robôs de IA se a configuração mandar', () => {
    const txt = robotsTxt({ ...site, aiRobots: 'block' })
    expect(txt).toContain('User-agent: GPTBot\nDisallow: /\n')
    expect(txt).toContain('User-agent: *\nAllow: /')
  })

  it('sitemap com lastmod real', () => {
    const xml = sitemapXml(site, [
      { path: '/', lastmod: '2026-11-21T02:30:00.000Z' },
      { path: '/tags/ia', lastmod: null },
    ])
    expect(xml).toContain(
      '<url><loc>https://blog.test/</loc><lastmod>2026-11-21T02:30:00.000Z</lastmod></url>',
    )
    expect(xml).toContain('<url><loc>https://blog.test/tags/ia</loc></url>')
  })
})
