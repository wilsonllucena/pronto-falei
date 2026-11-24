/**
 * Importação dos artigos de lançamento (content/artigos/*.md) — NÃO é o seed.
 *
 * Fala com o blog pela API REST (login de admin), então roda em qualquer lugar
 * com Node 24 (que executa .ts direto), inclusive contra a produção, sem
 * dependências. Idempotente por slug (posts, tags, categorias, séries) e pelo
 * texto alternativo (capas). Cria os posts como RASCUNHO; só publica com
 * --publicar. Post que já existe não é sobrescrito, a não ser com --atualizar.
 *
 *   node scripts/import-content.ts --url http://127.0.0.1:3130 \
 *     --credenciais ../secrets/admin.txt [--publicar] [--atualizar] [--simular]
 *
 * Credenciais: arquivo com linhas email=… e senha=… (o do create-admin.sh) ou
 * IMPORT_EMAIL / IMPORT_PASSWORD no ambiente. Nada é impresso.
 *
 * Este arquivo não importa nada do src/ (o Node não resolve os aliases do
 * tsconfig); o conversor de Markdown gera os mesmos nós do lexicalBuilder.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/* ------------------------------ tipos ------------------------------ */

export type Inline =
  string | { text: string; bold?: boolean; italic?: boolean; code?: boolean; href?: string }

export type Block =
  | string
  | { heading: string; tag?: 'h2' | 'h3' }
  | { paragraph: Inline[] }
  | { list: Inline[][]; ordered?: boolean }
  | { code: string; language: string; title?: string }
  | { callout: string; tone?: 'info' | 'dica' | 'atencao' | 'perigo'; title?: string }
  | { quote: string; author?: string; sourceUrl?: string }

export type Article = {
  file: string
  titulo: string
  slug: string
  linhaFina?: string
  categoria: string
  tags: string[]
  ordem: number
  destaque: boolean
  capa?: string
  serie?: string
  serieOrdem?: number
  resumo: string
  pontosChave: string[]
  body: string
}

export type Taxonomy = {
  categorias: { slug: string; nome: string; cor?: string; descricao?: string }[]
  tags: { slug: string; nome: string; descricao?: string }[]
  series: { slug: string; titulo: string; descricao?: string }[]
  capas: { chave: string; arquivo: string; alt: string }[]
}

/* Mesmas regras de src/lib/summary.ts e src/blocks (testadas em conjunto). */
export const RULES = {
  summaryMin: 160,
  summaryMax: 400,
  keyPointsMin: 3,
  keyPointsMax: 5,
  keyPointMax: 140,
  subtitleMax: 200,
}
export const CODE_LANGUAGES = [
  'text',
  'bash',
  'typescript',
  'javascript',
  'tsx',
  'json',
  'python',
  'go',
  'php',
  'sql',
  'yaml',
  'dockerfile',
  'html',
  'css',
  'markdown',
]
const LANGUAGE_ALIASES: Record<string, string> = {
  sh: 'bash',
  shell: 'bash',
  ts: 'typescript',
  js: 'javascript',
  yml: 'yaml',
}
const TONES = ['info', 'dica', 'atencao', 'perigo'] as const

/* --------------------------- frontmatter --------------------------- */

function scalar(raw: string): string | number | boolean {
  const v = raw.trim()
  if (/^".*"$/.test(v)) return JSON.parse(v) as string
  if (/^'.*'$/.test(v)) return v.slice(1, -1).replace(/''/g, "'")
  if (v === 'true' || v === 'false') return v === 'true'
  if (/^-?\d+$/.test(v)) return Number(v)
  return v
}

/** YAML mínimo: `chave: valor` e listas `- item`. Suficiente pros artigos. */
export function parseFrontmatter(src: string): { data: Record<string, unknown>; body: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(src)
  if (!m) throw new Error('frontmatter ausente (o arquivo precisa começar com ---)')
  const data: Record<string, unknown> = {}
  let listKey: string | null = null
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue
    const item = /^\s+-\s+(.*)$/.exec(line)
    if (item && listKey) {
      ;(data[listKey] as unknown[]).push(scalar(item[1]))
      continue
    }
    const kv = /^([A-Za-z][\w]*):\s*(.*)$/.exec(line)
    if (!kv) throw new Error(`frontmatter: linha inválida "${line}"`)
    if (kv[2] === '') {
      listKey = kv[1]
      data[kv[1]] = []
    } else {
      listKey = null
      data[kv[1]] = scalar(kv[2])
    }
  }
  return { data, body: m[2] }
}

/* ----------------------------- markdown ----------------------------- */

const INLINE_RE = /`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)|\*([^*\s][^*]*)\*/g

export function parseInline(text: string): Inline[] {
  const out: Inline[] = []
  let last = 0
  for (const m of text.matchAll(INLINE_RE)) {
    if (m.index > last) out.push(text.slice(last, m.index))
    if (m[1] !== undefined) out.push({ text: m[1], code: true })
    else if (m[2] !== undefined) out.push({ text: m[2], bold: true })
    else if (m[3] !== undefined) out.push({ text: m[3], href: m[4] })
    else out.push({ text: m[5], italic: true })
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

/** Texto puro (pra campos que não aceitam formatação, como o destaque). */
export const plainInline = (text: string) =>
  parseInline(text)
    .map((i) => (typeof i === 'string' ? i : i.text))
    .join('')

const paragraphBlock = (text: string): Block => {
  const inl = parseInline(text)
  return inl.length === 1 && typeof inl[0] === 'string' ? inl[0] : { paragraph: inl }
}

/**
 * Markdown → blocos do editor. Suporta: ## e ###, parágrafos, listas (- e 1.),
 * ```lang title="arquivo"```, citações (> … e "> — Autor") e destaques
 * (> [!dica] Título). Inline: `código`, **negrito**, *itálico* e [link](url).
 */
export function markdownToBlocks(md: string): Block[] {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      i++
      continue
    }
    const fence = /^```([\w-]*)(?:\s+title="([^"]*)")?\s*$/.exec(line)
    if (fence) {
      const code: string[] = []
      i++
      while (i < lines.length && !/^```\s*$/.test(lines[i])) code.push(lines[i++])
      if (i >= lines.length) throw new Error('bloco de código sem fechamento ```')
      i++
      const raw = (fence[1] || 'text').toLowerCase()
      const language = LANGUAGE_ALIASES[raw] ?? raw
      if (!CODE_LANGUAGES.includes(language)) throw new Error(`linguagem não suportada: ${raw}`)
      blocks.push({ code: code.join('\n'), language, ...(fence[2] ? { title: fence[2] } : {}) })
      continue
    }
    const heading = /^(#{2,3})\s+(.+)$/.exec(line)
    if (heading) {
      blocks.push({
        heading: plainInline(heading[2].trim()),
        tag: heading[1].length === 3 ? 'h3' : 'h2',
      })
      i++
      continue
    }
    if (/^#\s/.test(line)) throw new Error('use ## e ###; o # é o título do post')
    if (line.startsWith('>')) {
      const q: string[] = []
      while (i < lines.length && lines[i].startsWith('>')) q.push(lines[i++].replace(/^>\s?/, ''))
      const callout = /^\[!(\w+)\]\s*(.*)$/.exec(q[0])
      if (callout) {
        const tone = callout[1].toLowerCase()
        if (!(TONES as readonly string[]).includes(tone))
          throw new Error(`destaque inválido: ${tone}`)
        const content = plainInline(q.slice(1).join(' ').replace(/\s+/g, ' ').trim())
        if (!content) throw new Error('destaque sem texto')
        blocks.push({
          callout: content,
          tone: tone as (typeof TONES)[number],
          ...(callout[2] ? { title: plainInline(callout[2].trim()) } : {}),
        })
      } else {
        const authorLine = q.length > 1 ? /^[—–-]\s*(.+)$/.exec(q[q.length - 1]) : null
        const text = (authorLine ? q.slice(0, -1) : q).join(' ').replace(/\s+/g, ' ').trim()
        blocks.push({
          quote: plainInline(text),
          ...(authorLine ? { author: authorLine[1].trim() } : {}),
        })
      }
      continue
    }
    const bullet = /^[-*]\s+/
    const numbered = /^\d+\.\s+/
    if (bullet.test(line) || numbered.test(line)) {
      const ordered = numbered.test(line)
      const marker = ordered ? numbered : bullet
      const items: string[] = []
      while (i < lines.length && lines[i].trim()) {
        if (marker.test(lines[i])) items.push(lines[i].replace(marker, ''))
        else if (/^\s+\S/.test(lines[i]) && items.length)
          items[items.length - 1] += ' ' + lines[i].trim()
        else break
        i++
      }
      blocks.push({
        list: items.map((t) => parseInline(t.trim())),
        ...(ordered ? { ordered } : {}),
      })
      continue
    }
    const para: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(```|#{1,3}\s|>|[-*]\s|\d+\.\s)/.test(lines[i])
    ) {
      para.push(lines[i++].trim())
    }
    blocks.push(paragraphBlock(para.join(' ')))
  }
  return blocks
}

/* ------------------------------ lexical ------------------------------ */
/* Espelho de src/lib/lexicalBuilder.ts (o teste confere que batem). */

const FORMAT = { bold: 1, italic: 2, code: 16 }
const textNode = (text: string, format = 0) => ({
  type: 'text',
  text,
  detail: 0,
  format,
  mode: 'normal',
  style: '',
  version: 1,
})
const base = { direction: 'ltr' as const, format: '' as const, indent: 0, version: 1 }
let counter = 0
function blockId(): string {
  counter += 1
  return (Date.now().toString(16) + counter.toString(16).padStart(6, '0'))
    .padEnd(24, '0')
    .slice(0, 24)
}
function inlineNode(i: Inline) {
  if (typeof i === 'string') return textNode(i)
  const format =
    (i.bold ? FORMAT.bold : 0) | (i.italic ? FORMAT.italic : 0) | (i.code ? FORMAT.code : 0)
  const t = textNode(i.text, format)
  if (!i.href) return t
  return {
    ...base,
    type: 'link',
    version: 3,
    fields: { url: i.href, newTab: false, linkType: 'custom' },
    id: blockId(),
    children: [t],
  }
}
const blockNode = (blockType: string, fields: Record<string, unknown>) => ({
  type: 'block',
  version: 2,
  format: '',
  fields: { id: blockId(), blockName: '', blockType, ...fields },
})
function toNode(b: Block) {
  if (typeof b === 'string')
    return { ...base, type: 'paragraph', textFormat: 0, children: [textNode(b)] }
  if ('heading' in b)
    return { ...base, type: 'heading', tag: b.tag ?? 'h2', children: [textNode(b.heading)] }
  if ('paragraph' in b)
    return { ...base, type: 'paragraph', textFormat: 0, children: b.paragraph.map(inlineNode) }
  if ('list' in b) {
    return {
      ...base,
      type: 'list',
      listType: b.ordered ? 'number' : 'bullet',
      tag: b.ordered ? 'ol' : 'ul',
      start: 1,
      children: b.list.map((item, n) => ({
        ...base,
        type: 'listitem',
        value: n + 1,
        children: item.map(inlineNode),
      })),
    }
  }
  if ('code' in b) return blockNode('code', { code: b.code, language: b.language, title: b.title })
  if ('callout' in b)
    return blockNode('callout', { content: b.callout, tone: b.tone ?? 'info', title: b.title })
  return blockNode('quote', { text: b.quote, author: b.author, sourceUrl: b.sourceUrl })
}
export function lexicalFromBlocks(blocks: Block[]) {
  return {
    root: {
      type: 'root',
      direction: 'ltr' as const,
      format: '' as const,
      indent: 0,
      version: 1,
      children: blocks.map(toNode),
    },
  }
}

/* ----------------------------- artigos ----------------------------- */

const str = (v: unknown) => (typeof v === 'string' ? v : v === undefined ? undefined : String(v))

export function parseArticle(file: string, src: string): Article {
  const { data, body } = parseFrontmatter(src)
  const list = (k: string) => (Array.isArray(data[k]) ? (data[k] as unknown[]).map(String) : [])
  return {
    file,
    titulo: str(data.titulo) ?? '',
    slug: str(data.slug) ?? '',
    linhaFina: str(data.linhaFina),
    categoria: str(data.categoria) ?? '',
    tags: list('tags'),
    ordem: Number(data.ordem ?? 0),
    destaque: data.destaque === true,
    capa: str(data.capa),
    serie: str(data.serie),
    serieOrdem: data.serieOrdem === undefined ? undefined : Number(data.serieOrdem),
    resumo: str(data.resumo) ?? '',
    pontosChave: list('pontosChave'),
    body,
  }
}

/** Palavras do corpo (sem o frontmatter), contando o texto dos blocos de código. */
export const wordCount = (body: string) =>
  body.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length

/** Problemas que impediriam publicar (mesmas regras do admin). Vazio = ok. */
export function validateArticle(a: Article, tax: Taxonomy): string[] {
  const p: string[] = []
  if (!a.titulo) p.push('sem título')
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(a.slug)) p.push(`slug inválido "${a.slug}"`)
  if (a.linhaFina && a.linhaFina.length > RULES.subtitleMax) p.push('linha fina longa demais')
  if (a.resumo.length < RULES.summaryMin || a.resumo.length > RULES.summaryMax)
    p.push(
      `síntese com ${a.resumo.length} caracteres (precisa de ${RULES.summaryMin}–${RULES.summaryMax})`,
    )
  if (a.pontosChave.length < RULES.keyPointsMin || a.pontosChave.length > RULES.keyPointsMax)
    p.push(
      `${a.pontosChave.length} pontos-chave (precisa de ${RULES.keyPointsMin}–${RULES.keyPointsMax})`,
    )
  for (const k of a.pontosChave)
    if (k.length > RULES.keyPointMax) p.push(`ponto-chave longo demais: "${k.slice(0, 40)}…"`)
  if (!tax.categorias.some((c) => c.slug === a.categoria))
    p.push(`categoria desconhecida "${a.categoria}"`)
  for (const t of a.tags) if (!tax.tags.some((x) => x.slug === t)) p.push(`tag desconhecida "${t}"`)
  if (a.capa && !tax.capas.some((c) => c.chave === a.capa)) p.push(`capa desconhecida "${a.capa}"`)
  if (a.serie && !tax.series.some((s) => s.slug === a.serie))
    p.push(`série desconhecida "${a.serie}"`)
  if (a.serie && !a.serieOrdem) p.push('série sem serieOrdem')
  try {
    if (markdownToBlocks(a.body).length === 0) p.push('corpo vazio')
  } catch (err) {
    p.push(`markdown: ${(err as Error).message}`)
  }
  return p
}

export function loadContent(dir: string): {
  articles: Article[]
  taxonomy: Taxonomy
  coversDir: string
} {
  const taxonomy = JSON.parse(readFileSync(path.join(dir, 'taxonomia.json'), 'utf8')) as Taxonomy
  const artDir = path.join(dir, 'artigos')
  const articles = readdirSync(artDir)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((f) => parseArticle(f, readFileSync(path.join(artDir, f), 'utf8')))
  const slugs = new Set<string>()
  for (const a of articles) {
    if (slugs.has(a.slug)) throw new Error(`slug repetido: ${a.slug}`)
    slugs.add(a.slug)
  }
  return { articles, taxonomy, coversDir: path.join(dir, 'capas') }
}

/* ------------------------------- API ------------------------------- */

type Doc = { id: string; [k: string]: unknown }
type Coll = 'posts' | 'tags' | 'categories' | 'series' | 'media'

/** O que a importação precisa do Payload (REST na produção, Local API no teste). */
export interface ContentApi {
  findOne(collection: Coll, field: string, value: string): Promise<Doc | null>
  create(collection: Coll, data: Record<string, unknown>, opts?: { draft?: boolean }): Promise<Doc>
  update(
    collection: Coll,
    id: string,
    data: Record<string, unknown>,
    opts?: { draft?: boolean },
  ): Promise<Doc>
  upload(alt: string, file: { data: Buffer; name: string; mimetype: string }): Promise<Doc>
}

export function restApi(baseUrl: string, token: string): ContentApi {
  const root = baseUrl.replace(/\/+$/, '')
  const call = async (method: string, url: string, body?: BodyInit, json = true) => {
    const res = await fetch(root + url, {
      method,
      headers: {
        Authorization: `JWT ${token}`,
        ...(json && body ? { 'Content-Type': 'application/json' } : {}),
      },
      body,
    })
    const text = await res.text()
    if (!res.ok) throw new Error(`${method} ${url}: HTTP ${res.status} ${text.slice(0, 400)}`)
    return JSON.parse(text) as { doc?: Doc; docs?: Doc[] }
  }
  return {
    async findOne(collection, field, value) {
      const q = `where[${field}][equals]=${encodeURIComponent(value)}&limit=1&depth=0&draft=true`
      return (await call('GET', `/api/${collection}?${q}`)).docs?.[0] ?? null
    },
    async create(collection, data, opts) {
      return (
        await call(
          'POST',
          `/api/${collection}?depth=0${opts?.draft ? '&draft=true' : ''}`,
          JSON.stringify(data),
        )
      ).doc as Doc
    },
    async update(collection, id, data, opts) {
      return (
        await call(
          'PATCH',
          `/api/${collection}/${id}?depth=0${opts?.draft ? '&draft=true' : ''}`,
          JSON.stringify(data),
        )
      ).doc as Doc
    },
    async upload(alt, file) {
      const form = new FormData()
      form.append('file', new Blob([new Uint8Array(file.data)], { type: file.mimetype }), file.name)
      form.append('_payload', JSON.stringify({ alt, credit: 'Ilustração do blog' }))
      return (await call('POST', '/api/media?depth=0', form, false)).doc as Doc
    },
  }
}

export async function login(baseUrl: string, email: string, password: string): Promise<string> {
  const res = await fetch(baseUrl.replace(/\/+$/, '') + '/api/users/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) throw new Error(`login falhou (HTTP ${res.status})`)
  const { token } = (await res.json()) as { token?: string }
  if (!token) throw new Error('login sem token')
  return token
}

/** Lê email= e senha= (ou password=) de um arquivo key=valor. */
export function readCredentials(file: string): { email: string; password: string } {
  const kv = Object.fromEntries(
    readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .map((l) => /^\s*([\w]+)\s*=\s*(.*?)\s*$/.exec(l))
      .filter((m): m is RegExpExecArray => !!m)
      .map((m) => [m[1].toLowerCase(), m[2]]),
  )
  const email = kv.email
  const password = kv.senha ?? kv.password
  if (!email || !password) throw new Error(`credenciais: ${file} precisa de email= e senha=`)
  return { email, password }
}

/* ---------------------------- importação ---------------------------- */

export type ImportOptions = {
  publish?: boolean
  update?: boolean
  dryRun?: boolean
  /** Base da data de publicação: ordem 1 = agora, ordem 2 = 1 h antes… */
  now?: Date
  log?: (msg: string) => void
}

export type ImportReport = {
  created: string[]
  published: string[]
  updated: string[]
  skipped: string[]
}

export async function importContent(
  api: ContentApi,
  content: { articles: Article[]; taxonomy: Taxonomy; coversDir: string },
  opts: ImportOptions = {},
): Promise<ImportReport> {
  const { articles, taxonomy, coversDir } = content
  const log = opts.log ?? (() => {})
  const report: ImportReport = { created: [], published: [], updated: [], skipped: [] }

  const problems = articles.flatMap((a) =>
    validateArticle(a, taxonomy).map((p) => `${a.file}: ${p}`),
  )
  if (problems.length) throw new Error(`conteúdo inválido:\n- ${problems.join('\n- ')}`)
  if (opts.dryRun) {
    for (const a of articles) log(`[simular] ${a.slug} (${wordCount(a.body)} palavras)`)
    return report
  }

  const ensure = async (
    collection: Coll,
    slug: string,
    data: Record<string, unknown>,
    label: string,
  ) => {
    const found = await api.findOne(collection, 'slug', slug)
    if (found) return found.id
    const doc = await api.create(collection, { ...data, slug })
    report.created.push(label)
    log(`criado: ${label}`)
    return doc.id
  }

  const used = new Set(
    articles.flatMap((a) => [
      `c:${a.categoria}`,
      ...a.tags.map((t) => `t:${t}`),
      a.capa ? `k:${a.capa}` : '',
    ]),
  )
  const catIds: Record<string, string> = {}
  for (const c of taxonomy.categorias.filter((c) => used.has(`c:${c.slug}`)))
    catIds[c.slug] = await ensure(
      'categories',
      c.slug,
      { name: c.nome, color: c.cor, description: c.descricao },
      `categoria ${c.slug}`,
    )
  const tagIds: Record<string, string> = {}
  for (const t of taxonomy.tags.filter((t) => used.has(`t:${t.slug}`)))
    tagIds[t.slug] = await ensure(
      'tags',
      t.slug,
      { name: t.nome, description: t.descricao },
      `tag ${t.slug}`,
    )

  const coverIds: Record<string, string> = {}
  for (const c of taxonomy.capas.filter((c) => used.has(`k:${c.chave}`))) {
    const found = await api.findOne('media', 'alt', c.alt)
    if (found) {
      coverIds[c.chave] = found.id
      continue
    }
    const file = path.join(coversDir, c.arquivo)
    if (!existsSync(file)) throw new Error(`capa não encontrada: ${file}`)
    const doc = await api.upload(c.alt, {
      data: readFileSync(file),
      name: `capa-${c.arquivo}`,
      mimetype: 'image/png',
    })
    coverIds[c.chave] = doc.id
    report.created.push(`capa ${c.chave}`)
    log(`criado: capa ${c.chave}`)
  }

  const now = opts.now ?? new Date()
  const postIds: Record<string, string> = {}
  for (const a of [...articles].sort((x, y) => y.ordem - x.ordem)) {
    const data: Record<string, unknown> = {
      title: a.titulo,
      subtitle: a.linhaFina,
      category: catIds[a.categoria],
      tags: a.tags.map((t) => tagIds[t]),
      featured: a.destaque,
      cover: a.capa ? coverIds[a.capa] : undefined,
      content: lexicalFromBlocks(markdownToBlocks(a.body)),
      summary: a.resumo,
      keyPoints: a.pontosChave.map((text) => ({ text })),
      summarySource: 'manual',
      summaryReviewed: true,
    }
    const publishedAt = new Date(now.getTime() - Math.max(0, a.ordem - 1) * 3_600_000).toISOString()
    const existing = await api.findOne('posts', 'slug', a.slug)
    if (!existing) {
      const doc = opts.publish
        ? await api.create('posts', { ...data, slug: a.slug, _status: 'published', publishedAt })
        : await api.create('posts', { ...data, slug: a.slug, _status: 'draft' }, { draft: true })
      postIds[a.slug] = doc.id
      report.created.push(`post ${a.slug}`)
      if (opts.publish) report.published.push(a.slug)
      log(`criado: post ${a.slug} (${opts.publish ? 'publicado' : 'rascunho'})`)
      continue
    }
    postIds[a.slug] = existing.id
    const isPublished = existing._status === 'published'
    if (opts.publish && !isPublished) {
      await api.update('posts', existing.id, {
        ...(opts.update ? data : {}),
        _status: 'published',
        publishedAt: existing.publishedAt ?? publishedAt,
      })
      report.published.push(a.slug)
      log(`publicado: post ${a.slug}`)
    } else if (opts.update) {
      await api.update('posts', existing.id, data, { draft: !isPublished })
      report.updated.push(a.slug)
      log(`atualizado: post ${a.slug}`)
    } else {
      report.skipped.push(a.slug)
      log(`já existe: post ${a.slug} (${isPublished ? 'publicado' : 'rascunho'}), não mexi`)
    }
  }

  for (const s of taxonomy.series) {
    const parts = articles
      .filter((a) => a.serie === s.slug)
      .sort((x, y) => (x.serieOrdem ?? 0) - (y.serieOrdem ?? 0))
      .map((a) => postIds[a.slug])
    if (parts.length < 2) continue
    const found = await api.findOne('series', 'slug', s.slug)
    if (!found) {
      await api.create('series', {
        title: s.titulo,
        slug: s.slug,
        description: s.descricao,
        posts: parts,
      })
      report.created.push(`série ${s.slug}`)
      log(`criado: série ${s.slug}`)
    } else if (opts.update) {
      await api.update('series', found.id, {
        title: s.titulo,
        description: s.descricao,
        posts: parts,
      })
      report.updated.push(`série ${s.slug}`)
    }
  }
  return report
}

/* ------------------------------- CLI ------------------------------- */

export function parseArgs(argv: string[]) {
  const flag = (n: string) => argv.includes(n)
  const value = (n: string) => {
    const i = argv.indexOf(n)
    return i >= 0 ? argv[i + 1] : undefined
  }
  return {
    url: value('--url') ?? process.env.IMPORT_URL ?? 'http://127.0.0.1:3130',
    dir: value('--dir') ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../content'),
    credentials: value('--credenciais'),
    publish: flag('--publicar'),
    update: flag('--atualizar'),
    dryRun: flag('--simular'),
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const content = loadContent(args.dir)
  const log = (m: string) => console.log(`import-content: ${m}`)
  if (args.dryRun) {
    await importContent({} as ContentApi, content, { dryRun: true, log })
    log(`ok, ${content.articles.length} artigos válidos (nada foi gravado)`)
    return
  }
  const cred = args.credentials
    ? readCredentials(args.credentials)
    : { email: process.env.IMPORT_EMAIL ?? '', password: process.env.IMPORT_PASSWORD ?? '' }
  if (!cred.email || !cred.password)
    throw new Error('informe --credenciais <arquivo> ou IMPORT_EMAIL/IMPORT_PASSWORD')
  const token = await login(args.url, cred.email, cred.password)
  const r = await importContent(restApi(args.url, token), content, {
    publish: args.publish,
    update: args.update,
    log,
  })
  log(
    `fim: ${r.created.length} criados, ${r.published.length} publicados, ${r.updated.length} atualizados, ${r.skipped.length} sem mudança` +
      (args.publish ? '' : ' (posts novos ficaram como RASCUNHO; use --publicar pra publicar)'),
  )
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err: Error) => {
    console.error(`import-content: ERRO ${err.message}`)
    process.exit(1)
  })
}
