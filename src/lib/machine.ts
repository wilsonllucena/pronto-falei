/**
 * Síntese pra máquinas (passo 7): Markdown do post, llms.txt, llms-full.txt,
 * feeds (RSS, Atom, JSON Feed), JSON-LD, sitemap e robots.txt.
 * Tudo puro: recebe os dados já carregados e devolve texto.
 */
import { dateParts } from './dates'
import { escapeHtml, lexicalToHtml, lexicalToMarkdown } from './serialize'

export type MachinePost = {
  slug: string
  title: string
  subtitle: string | null
  summary: string
  keyPoints: string[]
  publishedAt: string
  updatedAt: string
  tags: { name: string; slug: string }[]
  category: { name: string; slug: string } | null
  readingTime: number | null
  wordCount: number | null
  content: unknown
  cover: { url: string; width: number; height: number; alt: string } | null
}

export type MachinePage = {
  slug: string
  title: string
  description: string | null
  updatedAt: string
  content: unknown
}

export type SiteInfo = {
  name: string
  tagline: string
  /** URL base sem barra no fim, ex.: https://prontofalei.dev */
  url: string
  author: { name: string; url: string; sameAs: string[] }
  llmsIntro: string | null
  aiRobots: 'allow' | 'block'
}

export const FEED_LIMIT = 30

export const FEED_PATHS = {
  rss: '/rss.xml',
  atom: '/atom.xml',
  json: '/feed.json',
  llms: '/llms.txt',
  llmsFull: '/llms-full.txt',
  sitemap: '/sitemap.xml',
} as const

export const postPath = (slug: string) => `/posts/${slug}`
export const postMdPath = (slug: string) => `/posts/${slug}.md`
export const pageMdPath = (slug: string) => `/${slug}.md`

const abs = (site: SiteInfo) => (path: string) =>
  /^https?:\/\//i.test(path) ? path : `${site.url}${path.startsWith('/') ? path : `/${path}`}`

/** "2026-11-20" no fuso do site. */
export function isoDate(value: string | Date): string {
  const { year, month, day } = dateParts(value)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** String YAML segura (aspas duplas, escapes de JSON são YAML válido). */
const y = (s: string) => JSON.stringify(s)

/* ------------------------------- Markdown ------------------------------- */

export function postMarkdown(post: MachinePost, site: SiteInfo): string {
  const url = abs(site)(postPath(post.slug))
  const fm = [
    '---',
    `title: ${y(post.title)}`,
    ...(post.subtitle ? [`subtitle: ${y(post.subtitle)}`] : []),
    `url: ${url}`,
    `published: ${isoDate(post.publishedAt)}`,
    `updated: ${isoDate(post.updatedAt)}`,
    `author: ${y(site.author.name)}`,
    'lang: pt-BR',
    ...(post.category ? [`category: ${y(post.category.name)}`] : []),
    `tags: [${post.tags.map((t) => y(t.slug)).join(', ')}]`,
    ...(post.readingTime ? [`reading_time: ${y(`${post.readingTime} min`)}`] : []),
    ...(post.wordCount ? [`word_count: ${post.wordCount}`] : []),
    `summary: ${y(post.summary)}`,
    ...(post.keyPoints.length ? ['key_points:', ...post.keyPoints.map((k) => `  - ${y(k)}`)] : []),
    '---',
  ]
  const body = lexicalToMarkdown(post.content, { absolute: abs(site) })
  const head = [`# ${post.title}`]
  if (post.subtitle) head.push(`_${post.subtitle}_`)
  if (post.summary)
    head.push(
      post.summary
        .split('\n')
        .map((l) => `> ${l}`)
        .join('\n'),
    )
  if (post.keyPoints.length) {
    head.push(['**Pontos-chave**', '', ...post.keyPoints.map((k) => `- ${k}`)].join('\n'))
  }
  return `${fm.join('\n')}\n\n${head.join('\n\n')}\n\n${body}\n`.replace(/\n{3,}/g, '\n\n')
}

export function pageMarkdown(page: MachinePage, site: SiteInfo): string {
  const fm = [
    '---',
    `title: ${y(page.title)}`,
    `url: ${abs(site)(`/${page.slug}`)}`,
    `updated: ${isoDate(page.updatedAt)}`,
    'lang: pt-BR',
    ...(page.description ? [`description: ${y(page.description)}`] : []),
    '---',
  ]
  const body = lexicalToMarkdown(page.content, { absolute: abs(site) })
  return `${fm.join('\n')}\n\n# ${page.title}\n\n${body}\n`.replace(/\n{3,}/g, '\n\n')
}

/* ------------------------------- llms.txt ------------------------------- */

const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim()

/** Índice no padrão llmstxt.org. */
export function llmsTxt(site: SiteInfo, posts: MachinePost[], pages: MachinePage[]): string {
  const a = abs(site)
  const intro =
    site.llmsIntro?.trim() ||
    `Blog do ${site.author.name} sobre tecnologia, inovação, inteligência artificial e assuntos do cotidiano, sem complicação e sem rodeios. Em pt-BR.`
  const lines = [
    `# ${site.name}`,
    '',
    ...intro.split('\n').map((l) => `> ${l}`.trimEnd()),
    '',
    `Cada post tem uma versão em Markdown (link abaixo) com frontmatter: título, datas, tags, summary (TL;DR revisado pelo autor) e key_points.`,
    '',
    '## Posts',
    ...posts.map((p) => `- [${oneLine(p.title)}](${a(postMdPath(p.slug))}): ${oneLine(p.summary)}`),
  ]
  if (pages.length) {
    lines.push(
      '',
      '## Páginas',
      ...pages.map(
        (p) =>
          `- [${oneLine(p.title)}](${a(pageMdPath(p.slug))})${p.description ? `: ${oneLine(p.description)}` : ''}`,
      ),
    )
  }
  lines.push(
    '',
    '## Opcional',
    `- [Todos os textos completos](${a(FEED_PATHS.llmsFull)}): todos os posts publicados em Markdown, num arquivo só`,
    `- [RSS](${a(FEED_PATHS.rss)})`,
    `- [Sitemap](${a(FEED_PATHS.sitemap)})`,
  )
  return `${lines.join('\n')}\n`
}

export function llmsFullTxt(site: SiteInfo, posts: MachinePost[]): string {
  const head = [
    `# ${site.name}: todos os textos`,
    '',
    `> ${posts.length} posts publicados, do mais novo pro mais antigo. Autor: ${site.author.name}. Índice: ${abs(site)(FEED_PATHS.llms)}`,
  ].join('\n')
  return `${[head, ...posts.map((p) => postMarkdown(p, site).trim())].join('\n\n---\n\n')}\n`
}

/* --------------------------------- Feeds -------------------------------- */

const cdata = (s: string) => `<![CDATA[${s.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`

export function postHtml(post: MachinePost, site: SiteInfo): string {
  const a = abs(site)
  const points = post.keyPoints.length
    ? `<p><strong>Pontos-chave</strong></p><ul>${post.keyPoints.map((k) => `<li>${escapeHtml(k)}</li>`).join('')}</ul>`
    : ''
  const cover = post.cover
    ? `<p><img src="${escapeHtml(a(post.cover.url))}" alt="${escapeHtml(post.cover.alt)}" width="${post.cover.width}" height="${post.cover.height}"></p>`
    : ''
  return `${cover}<blockquote><p>${escapeHtml(post.summary)}</p></blockquote>${points}\n${lexicalToHtml(post.content, { absolute: a })}`
}

export function rssXml(site: SiteInfo, posts: MachinePost[]): string {
  const a = abs(site)
  const last = posts[0]?.updatedAt ?? new Date(0).toISOString()
  const items = posts.map((p) => {
    const url = a(postPath(p.slug))
    return [
      '    <item>',
      `      <title>${escapeHtml(p.title)}</title>`,
      `      <link>${url}</link>`,
      `      <guid isPermaLink="true">${url}</guid>`,
      `      <pubDate>${new Date(p.publishedAt).toUTCString()}</pubDate>`,
      `      <dc:creator>${escapeHtml(site.author.name)}</dc:creator>`,
      ...(p.category ? [`      <category>${escapeHtml(p.category.name)}</category>`] : []),
      ...p.tags.map((t) => `      <category>${escapeHtml(t.name)}</category>`),
      `      <description>${escapeHtml(p.summary)}</description>`,
      `      <content:encoded>${cdata(postHtml(p, site))}</content:encoded>`,
      '    </item>',
    ].join('\n')
  })
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    `    <title>${escapeHtml(site.name)}</title>`,
    `    <link>${site.url}/</link>`,
    `    <description>${escapeHtml(site.tagline)}</description>`,
    '    <language>pt-BR</language>',
    `    <lastBuildDate>${new Date(last).toUTCString()}</lastBuildDate>`,
    `    <atom:link href="${a(FEED_PATHS.rss)}" rel="self" type="application/rss+xml"/>`,
    ...items,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n')
}

export function atomXml(site: SiteInfo, posts: MachinePost[]): string {
  const a = abs(site)
  const updated = posts.reduce(
    (m, p) => (p.updatedAt > m ? p.updatedAt : m),
    new Date(0).toISOString(),
  )
  const entries = posts.map((p) => {
    const url = a(postPath(p.slug))
    return [
      '  <entry>',
      `    <title>${escapeHtml(p.title)}</title>`,
      `    <link rel="alternate" type="text/html" href="${url}"/>`,
      `    <link rel="alternate" type="text/markdown" href="${a(postMdPath(p.slug))}"/>`,
      `    <id>${url}</id>`,
      `    <published>${new Date(p.publishedAt).toISOString()}</published>`,
      `    <updated>${new Date(p.updatedAt).toISOString()}</updated>`,
      ...p.tags.map(
        (t) => `    <category term="${escapeHtml(t.slug)}" label="${escapeHtml(t.name)}"/>`,
      ),
      `    <summary>${escapeHtml(p.summary)}</summary>`,
      `    <content type="html">${escapeHtml(postHtml(p, site))}</content>`,
      '  </entry>',
    ].join('\n')
  })
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="pt-BR">',
    `  <title>${escapeHtml(site.name)}</title>`,
    `  <subtitle>${escapeHtml(site.tagline)}</subtitle>`,
    `  <link rel="alternate" type="text/html" href="${site.url}/"/>`,
    `  <link rel="self" type="application/atom+xml" href="${a(FEED_PATHS.atom)}"/>`,
    `  <id>${site.url}/</id>`,
    `  <updated>${new Date(updated).toISOString()}</updated>`,
    `  <author><name>${escapeHtml(site.author.name)}</name><uri>${site.author.url}</uri></author>`,
    ...entries,
    '</feed>',
    '',
  ].join('\n')
}

/** JSON Feed 1.1. */
export function jsonFeed(site: SiteInfo, posts: MachinePost[]) {
  const a = abs(site)
  return {
    version: 'https://jsonfeed.org/version/1.1',
    title: site.name,
    description: site.tagline,
    home_page_url: `${site.url}/`,
    feed_url: a(FEED_PATHS.json),
    language: 'pt-BR',
    authors: [{ name: site.author.name, url: site.author.url }],
    items: posts.map((p) => ({
      id: a(postPath(p.slug)),
      url: a(postPath(p.slug)),
      title: p.title,
      summary: p.summary,
      content_html: postHtml(p, site),
      date_published: new Date(p.publishedAt).toISOString(),
      date_modified: new Date(p.updatedAt).toISOString(),
      tags: p.tags.map((t) => t.name),
      ...(p.cover ? { image: a(p.cover.url) } : {}),
      _markdown_url: a(postMdPath(p.slug)),
      _key_points: p.keyPoints,
    })),
  }
}

/* -------------------------------- JSON-LD ------------------------------- */

export function blogPostingJsonLd(post: MachinePost, site: SiteInfo) {
  const a = abs(site)
  const url = a(postPath(post.slug))
  const author = {
    '@type': 'Person',
    name: site.author.name,
    url: site.author.url,
    ...(site.author.sameAs.length ? { sameAs: site.author.sameAs } : {}),
  }
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `${url}#post`,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    url,
    headline: post.title,
    ...(post.subtitle ? { alternativeHeadline: post.subtitle } : {}),
    abstract: post.summary,
    description: post.summary,
    keywords: post.tags.map((t) => t.name).join(', '),
    ...(post.category ? { articleSection: post.category.name } : {}),
    ...(post.wordCount ? { wordCount: post.wordCount } : {}),
    ...(post.readingTime ? { timeRequired: `PT${post.readingTime}M` } : {}),
    inLanguage: 'pt-BR',
    datePublished: new Date(post.publishedAt).toISOString(),
    dateModified: new Date(post.updatedAt).toISOString(),
    author,
    publisher: author,
    image: post.cover ? a(post.cover.url) : a(`${postPath(post.slug)}/opengraph-image`),
    isPartOf: { '@type': 'Blog', '@id': `${site.url}/#blog`, name: site.name },
    encoding: {
      '@type': 'MediaObject',
      encodingFormat: 'text/markdown',
      contentUrl: a(postMdPath(post.slug)),
    },
  }
}

export function websiteJsonLd(site: SiteInfo) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${site.url}/#site`,
    url: `${site.url}/`,
    name: site.name,
    description: site.tagline,
    inLanguage: 'pt-BR',
    author: { '@type': 'Person', name: site.author.name, url: site.author.url },
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${site.url}/busca?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  }
}

/** JSON pra dentro de <script type="application/ld+json"> sem fechar a tag. */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/\u2028|\u2029/g, '')
}

/* --------------------------- robots e sitemap --------------------------- */

/** Robôs de IA conhecidos (treino, busca e leitura sob demanda). */
export const AI_BOTS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-SearchBot',
  'Claude-User',
  'anthropic-ai',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
  'Meta-ExternalAgent',
  'CCBot',
  'cohere-ai',
  'MistralAI-User',
  'DuckAssistBot',
] as const

// /md/ é o caminho interno dos .md (o público é /posts/slug.md)
const PRIVATE_PATHS = ['/admin', '/api/', '/md/', '/*?preview=']

export function robotsTxt(site: SiteInfo): string {
  const lines = ['User-agent: *', 'Allow: /', ...PRIVATE_PATHS.map((p) => `Disallow: ${p}`), '']
  lines.push(
    site.aiRobots === 'allow'
      ? '# Robôs de IA liberados: o blog quer ser lido e citado (veja /llms.txt).'
      : '# Robôs de IA bloqueados nas configurações do site.',
  )
  for (const bot of AI_BOTS) {
    lines.push(`User-agent: ${bot}`)
    if (site.aiRobots === 'allow') {
      lines.push('Allow: /', ...PRIVATE_PATHS.map((p) => `Disallow: ${p}`))
    } else {
      lines.push('Disallow: /')
    }
    lines.push('')
  }
  lines.push(`Sitemap: ${abs(site)(FEED_PATHS.sitemap)}`, '')
  return lines.join('\n')
}

export type SitemapEntry = { path: string; lastmod?: string | null }

export function sitemapXml(site: SiteInfo, entries: SitemapEntry[]): string {
  const a = abs(site)
  const urls = entries.map(
    (e) =>
      `  <url><loc>${escapeHtml(a(e.path))}</loc>${e.lastmod ? `<lastmod>${new Date(e.lastmod).toISOString()}</lastmod>` : ''}</url>`,
  )
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n')
}
