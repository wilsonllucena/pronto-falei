/**
 * Lexical (JSON do Payload) → Markdown e HTML, pros robôs e pros feeds.
 * Conversor próprio (sem editorConfig) que cobre os nós do editor do blog:
 * texto com formatos, links (inclusive internos), títulos, listas (aninhadas
 * e de tarefa), citação, régua, imagem com legenda e os blocos Código,
 * Destaque, Citação e Embed. Funções puras, testadas sem banco.
 */
import { parseEmbed } from './post'

export type LexNode = {
  type?: string
  text?: string
  format?: number | string
  tag?: string
  listType?: 'bullet' | 'number' | 'check'
  start?: number
  checked?: boolean
  url?: string
  relationTo?: string
  value?: unknown
  fields?: Record<string, unknown> | null
  children?: LexNode[]
}

export type SerializeOptions = {
  /** Transforma caminho interno ("/posts/x") em URL absoluta. */
  absolute: (path: string) => string
}

const F = { bold: 1, italic: 2, strike: 4, underline: 8, code: 16, sub: 32, sup: 64 }

const CALLOUT_LABEL: Record<string, string> = {
  info: 'Info',
  dica: 'Dica',
  atencao: 'Atenção',
  perigo: 'Perigo',
}

type Media = { url?: string | null; alt?: string | null; width?: number; height?: number }

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

/** URL absoluta pra links e imagens (http(s), mailto e âncoras passam direto). */
function resolveUrl(raw: string, o: SerializeOptions): string {
  const url = raw.trim()
  if (!url) return ''
  if (/^(https?:|mailto:|tel:|#)/i.test(url)) return url
  if (url.startsWith('/')) return o.absolute(url)
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return '' // javascript:, data: etc.
  return url
}

function docPath(relationTo: unknown, value: unknown): string | null {
  if (!isObj(value) || typeof value.slug !== 'string') return null
  return relationTo === 'posts' ? `/posts/${value.slug}` : `/${value.slug}`
}

function linkHref(node: LexNode, o: SerializeOptions): string {
  const f = node.fields ?? {}
  if (f.linkType === 'internal') {
    const doc = f.doc as { relationTo?: string; value?: unknown } | undefined
    const path = docPath(doc?.relationTo, doc?.value)
    return path ? o.absolute(path) : ''
  }
  return resolveUrl(String(f.url ?? node.url ?? ''), o)
}

function mediaOf(node: LexNode): Media | null {
  return isObj(node.value) ? (node.value as Media) : null
}

const fmt = (n: LexNode) => (typeof n.format === 'number' ? n.format : 0)

/* ------------------------------- Markdown ------------------------------- */

const mdEscape = (s: string) => s.replace(/([\\`*_[\]<>])/g, '\\$1')

function mdInline(nodes: LexNode[] = [], o: SerializeOptions): string {
  return nodes
    .map((n) => {
      if (n.type === 'text') {
        const f = fmt(n)
        const raw = n.text ?? ''
        if (!raw) return ''
        if (f & F.code) {
          const fence = raw.includes('`') ? '``' : '`'
          return `${fence}${raw}${fence}`
        }
        // espaços nas pontas ficam fora da marcação (senão o Markdown quebra)
        const [, lead, core, trail] = raw.match(/^(\s*)([\s\S]*?)(\s*)$/) ?? ['', '', raw, '']
        let s = mdEscape(core)
        if (!s) return raw
        if (f & F.bold) s = `**${s}**`
        if (f & F.italic) s = `_${s}_`
        if (f & F.strike) s = `~~${s}~~`
        return `${lead}${s}${trail}`
      }
      if (n.type === 'linebreak') return '  \n'
      if (n.type === 'tab') return '\t'
      if (n.type === 'link' || n.type === 'autolink') {
        const href = linkHref(n, o)
        const label = mdInline(n.children, o)
        return href ? `[${label}](${href})` : label
      }
      return mdInline(n.children, o)
    })
    .join('')
}

function mdList(node: LexNode, o: SerializeOptions, depth: number): string {
  const ordered = node.listType === 'number'
  let i = node.start ?? 1
  const lines: string[] = []
  for (const item of node.children ?? []) {
    const nested = (item.children ?? []).filter((c) => c.type === 'list')
    const inline = (item.children ?? []).filter((c) => c.type !== 'list')
    const indent = '  '.repeat(depth)
    const text = mdInline(inline, o).trim()
    if (text || !nested.length) {
      const marker = ordered
        ? `${i++}.`
        : node.listType === 'check'
          ? `- [${item.checked ? 'x' : ' '}]`
          : '-'
      lines.push(`${indent}${marker} ${text}`)
    }
    for (const n of nested) lines.push(mdList(n, o, depth + 1))
  }
  return lines.join('\n')
}

function fence(code: string): string {
  const longest = Math.max(2, ...(code.match(/`+/g) ?? []).map((m) => m.length))
  return '`'.repeat(longest + 1)
}

const quoteLines = (s: string) =>
  s
    .split('\n')
    .map((l) => (l ? `> ${l}` : '>'))
    .join('\n')

function mdBlock(n: LexNode, o: SerializeOptions): string {
  switch (n.type) {
    case 'paragraph':
      return mdInline(n.children, o).trim()
    case 'heading': {
      const level = Number(String(n.tag ?? 'h2').slice(1)) || 2
      return `${'#'.repeat(Math.min(6, level))} ${mdInline(n.children, o).trim()}`
    }
    case 'list':
      return mdList(n, o, 0)
    case 'quote':
      return quoteLines(mdInline(n.children, o).trim())
    case 'horizontalrule':
      return '---'
    case 'upload': {
      const m = mediaOf(n)
      if (!m?.url) return ''
      const caption = typeof n.fields?.caption === 'string' ? n.fields.caption : ''
      const img = `![${mdEscape(m.alt ?? '')}](${resolveUrl(m.url, o)})`
      return caption ? `${img}\n_${mdEscape(caption)}_` : img
    }
    case 'relationship': {
      const path = docPath(n.relationTo, n.value)
      const title = isObj(n.value) ? String(n.value.title ?? path ?? '') : ''
      return path ? `[${mdEscape(title)}](${o.absolute(path)})` : ''
    }
    case 'block': {
      const f = n.fields ?? {}
      if (f.blockType === 'code') {
        const code = String(f.code ?? '').replace(/\n+$/, '')
        const fen = fence(code)
        const title = f.title ? `${mdEscape(String(f.title))}:\n\n` : ''
        return `${title}${fen}${String(f.language ?? '')}\n${code}\n${fen}`
      }
      if (f.blockType === 'callout') {
        const label = CALLOUT_LABEL[String(f.tone)] ?? 'Nota'
        const title = f.title ? `${label}: ${String(f.title)}` : label
        return quoteLines(`**${mdEscape(title)}**\n${String(f.content ?? '').trim()}`)
      }
      if (f.blockType === 'quote') {
        const author = f.author ? String(f.author) : ''
        const src = f.sourceUrl ? resolveUrl(String(f.sourceUrl), o) : ''
        const cite = author ? (src ? `[${mdEscape(author)}](${src})` : mdEscape(author)) : src
        return quoteLines(`${String(f.text ?? '').trim()}${cite ? `\n\n— ${cite}` : ''}`)
      }
      if (f.blockType === 'embed') {
        const e = parseEmbed(String(f.url ?? ''))
        const url = e.kind === 'youtube' ? `https://www.youtube.com/watch?v=${e.id}` : e.url
        const label =
          e.kind === 'youtube' ? 'Vídeo no YouTube' : e.kind === 'x' ? 'Post no X' : 'Link'
        const caption = f.caption ? ` — ${mdEscape(String(f.caption))}` : ''
        return `[${label}](${url})${caption}`
      }
      return ''
    }
    default:
      return n.children ? mdInline(n.children, o).trim() : ''
  }
}

/** Corpo do post em Markdown (CommonMark + GFM). */
export function lexicalToMarkdown(state: unknown, o: SerializeOptions): string {
  const root = isObj(state) && isObj(state.root) ? (state.root as LexNode) : null
  if (!root) return ''
  return (root.children ?? [])
    .map((n) => mdBlock(n, o))
    .filter((s) => s.trim())
    .join('\n\n')
}

/* --------------------------------- HTML --------------------------------- */

export const escapeHtml = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

function htmlInline(nodes: LexNode[] = [], o: SerializeOptions): string {
  return nodes
    .map((n) => {
      if (n.type === 'text') {
        const f = fmt(n)
        let s = escapeHtml(n.text ?? '')
        if (f & F.code) s = `<code>${s}</code>`
        if (f & F.bold) s = `<strong>${s}</strong>`
        if (f & F.italic) s = `<em>${s}</em>`
        if (f & F.strike) s = `<s>${s}</s>`
        if (f & F.underline) s = `<u>${s}</u>`
        if (f & F.sub) s = `<sub>${s}</sub>`
        if (f & F.sup) s = `<sup>${s}</sup>`
        return s
      }
      if (n.type === 'linebreak') return '<br>'
      if (n.type === 'tab') return '\t'
      if (n.type === 'link' || n.type === 'autolink') {
        const href = linkHref(n, o)
        const label = htmlInline(n.children, o)
        return href ? `<a href="${escapeHtml(href)}">${label}</a>` : label
      }
      return htmlInline(n.children, o)
    })
    .join('')
}

function htmlList(n: LexNode, o: SerializeOptions): string {
  const tag = n.listType === 'number' ? 'ol' : 'ul'
  const start = tag === 'ol' && n.start && n.start !== 1 ? ` start="${n.start}"` : ''
  const items = (n.children ?? []).map((item) => {
    const nested = (item.children ?? []).filter((c) => c.type === 'list')
    const inline = (item.children ?? []).filter((c) => c.type !== 'list')
    const box = n.listType === 'check' ? (item.checked ? '☑ ' : '☐ ') : ''
    return `<li>${box}${htmlInline(inline, o)}${nested.map((x) => htmlList(x, o)).join('')}</li>`
  })
  return `<${tag}${start}>${items.join('')}</${tag}>`
}

function htmlBlock(n: LexNode, o: SerializeOptions): string {
  switch (n.type) {
    case 'paragraph': {
      const inner = htmlInline(n.children, o)
      return inner.trim() ? `<p>${inner}</p>` : ''
    }
    case 'heading': {
      const tag = /^h[1-6]$/.test(String(n.tag)) ? String(n.tag) : 'h2'
      return `<${tag}>${htmlInline(n.children, o)}</${tag}>`
    }
    case 'list':
      return htmlList(n, o)
    case 'quote':
      return `<blockquote><p>${htmlInline(n.children, o)}</p></blockquote>`
    case 'horizontalrule':
      return '<hr>'
    case 'upload': {
      const m = mediaOf(n)
      if (!m?.url) return ''
      const caption = typeof n.fields?.caption === 'string' ? n.fields.caption : ''
      const size = m.width && m.height ? ` width="${m.width}" height="${m.height}"` : ''
      const img = `<img src="${escapeHtml(resolveUrl(m.url, o))}" alt="${escapeHtml(m.alt ?? '')}"${size}>`
      return `<figure>${img}${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ''}</figure>`
    }
    case 'relationship': {
      const path = docPath(n.relationTo, n.value)
      const title = isObj(n.value) ? String(n.value.title ?? path ?? '') : ''
      return path ? `<p><a href="${escapeHtml(o.absolute(path))}">${escapeHtml(title)}</a></p>` : ''
    }
    case 'block': {
      const f = n.fields ?? {}
      if (f.blockType === 'code') {
        const lang = String(f.language ?? '')
        const title = f.title ? `<figcaption>${escapeHtml(String(f.title))}</figcaption>` : ''
        const code = escapeHtml(String(f.code ?? '').replace(/\n+$/, ''))
        return `<figure>${title}<pre><code${lang ? ` class="language-${escapeHtml(lang)}"` : ''}>${code}</code></pre></figure>`
      }
      if (f.blockType === 'callout') {
        const label = CALLOUT_LABEL[String(f.tone)] ?? 'Nota'
        const title = f.title ? `${label}: ${String(f.title)}` : label
        const body = escapeHtml(String(f.content ?? '').trim()).replace(/\n/g, '<br>')
        return `<blockquote><p><strong>${escapeHtml(title)}</strong></p><p>${body}</p></blockquote>`
      }
      if (f.blockType === 'quote') {
        const text = escapeHtml(String(f.text ?? '').trim()).replace(/\n/g, '<br>')
        const author = f.author ? escapeHtml(String(f.author)) : ''
        const src = f.sourceUrl ? resolveUrl(String(f.sourceUrl), o) : ''
        const cite = author
          ? src
            ? `<a href="${escapeHtml(src)}">${author}</a>`
            : author
          : src
            ? `<a href="${escapeHtml(src)}">${escapeHtml(src)}</a>`
            : ''
        return `<blockquote><p>${text}</p>${cite ? `<p>— ${cite}</p>` : ''}</blockquote>`
      }
      if (f.blockType === 'embed') {
        const e = parseEmbed(String(f.url ?? ''))
        const url = e.kind === 'youtube' ? `https://www.youtube.com/watch?v=${e.id}` : e.url
        const label =
          e.kind === 'youtube' ? 'Vídeo no YouTube' : e.kind === 'x' ? 'Post no X' : 'Link'
        const caption = f.caption ? ` — ${escapeHtml(String(f.caption))}` : ''
        return `<p><a href="${escapeHtml(url)}">${label}</a>${caption}</p>`
      }
      return ''
    }
    default:
      return n.children ? `<p>${htmlInline(n.children, o)}</p>` : ''
  }
}

/** Corpo do post em HTML simples (feeds: content:encoded, Atom, JSON Feed). */
export function lexicalToHtml(state: unknown, o: SerializeOptions): string {
  const root = isObj(state) && isObj(state.root) ? (state.root as LexNode) : null
  if (!root) return ''
  return (root.children ?? [])
    .map((n) => htmlBlock(n, o))
    .filter(Boolean)
    .join('\n')
}
