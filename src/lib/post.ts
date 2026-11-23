/** Regras da página do post que dá pra testar sem banco. */
import type { Post, Tag } from '../payload-types'
import { toSlug } from './slugify'

export type TocItem = { id: string; text: string; level: 2 | 3 }

type LexNode = {
  type?: string
  tag?: string
  text?: string
  children?: LexNode[]
  anchorId?: string
  [key: string]: unknown
}

function nodeText(node: LexNode): string {
  if (typeof node.text === 'string') return node.text
  return (node.children ?? []).map(nodeText).join('')
}

/**
 * Dá um id estável (âncora) a cada subtítulo h2/h3 e devolve o índice.
 * Trabalha numa cópia: o conteúdo original (que pode vir do cache) não muda.
 */
export function withHeadingAnchors<T>(content: T): { content: T; toc: TocItem[] } {
  if (!content || typeof content !== 'object') return { content, toc: [] }
  const copy = structuredClone(content) as T & { root?: LexNode }
  const toc: TocItem[] = []
  const used = new Map<string, number>()
  const walk = (node: LexNode | undefined) => {
    if (!node) return
    if (node.type === 'heading' && (node.tag === 'h2' || node.tag === 'h3')) {
      const text = nodeText(node).trim()
      const base = toSlug(text) || 'secao'
      const n = (used.get(base) ?? 0) + 1
      used.set(base, n)
      const id = n === 1 ? base : `${base}-${n}`
      node.anchorId = id
      toc.push({ id, text, level: node.tag === 'h2' ? 2 : 3 })
    }
    node.children?.forEach(walk)
  }
  walk(copy.root)
  return { content: copy, toc }
}

const tagIds = (p: Pick<Post, 'tags'>): string[] =>
  (p.tags ?? []).map((t) => (typeof t === 'string' ? t : (t as Tag).id))

/**
 * Posts relacionados: o override manual vem primeiro (só os publicados);
 * se faltar, completa com os que têm mais tags em comum e, no empate, os
 * mais novos.
 */
export function pickRelated(
  current: Pick<Post, 'id' | 'tags' | 'relatedPosts'>,
  candidates: Post[],
  limit = 3,
): Post[] {
  const manual = (current.relatedPosts ?? []).filter(
    (p): p is Post => typeof p === 'object' && p !== null && p._status === 'published',
  )
  const chosen = manual.filter((p) => p.id !== current.id).slice(0, limit)
  if (manual.length > 0) return chosen
  const mine = new Set(tagIds(current))
  const scored = candidates
    .filter((p) => p.id !== current.id && p._status !== 'draft')
    .map((p) => ({ p, score: tagIds(p).filter((id) => mine.has(id)).length }))
    .filter((s) => s.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        new Date(b.p.publishedAt ?? 0).getTime() - new Date(a.p.publishedAt ?? 0).getTime(),
    )
  return scored.slice(0, limit).map((s) => s.p)
}

/** Links "Resumir com IA": abrem o assistente já com o pedido e a URL do .md. */
export function summarizeWithAiLinks(markdownUrl: string): { label: string; href: string }[] {
  const prompt = `Resuma em português, em tópicos, o texto em ${markdownUrl}`
  const q = encodeURIComponent(prompt)
  return [
    { label: 'Grok', href: `https://grok.com/?q=${q}` },
    { label: 'ChatGPT', href: `https://chatgpt.com/?q=${q}` },
    { label: 'Claude', href: `https://claude.ai/new?q=${q}` },
  ]
}

export type Embed =
  | { kind: 'youtube'; id: string; src: string }
  | { kind: 'x'; url: string; handle: string | null; isPost: boolean }
  | { kind: 'link'; url: string }

/** YouTube vira iframe sem cookies; X vira um cartão com link (zero JS de terceiros). */
export function parseEmbed(raw: string): Embed {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return { kind: 'link', url: raw }
  }
  const host = url.hostname.replace(/^www\./, '')
  let id: string | null = null
  if (host === 'youtu.be') id = url.pathname.slice(1).split('/')[0] || null
  if (host === 'youtube.com') {
    id =
      url.searchParams.get('v') ||
      url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?]+)/)?.[1] ||
      null
  }
  if (id && /^[\w-]{6,20}$/.test(id)) {
    return { kind: 'youtube', id, src: `https://www.youtube-nocookie.com/embed/${id}` }
  }
  if (host === 'x.com' || host === 'twitter.com') {
    const parts = url.pathname.split('/').filter(Boolean)
    return {
      kind: 'x',
      url: `https://x.com${url.pathname}`,
      handle: parts[0] || null,
      isPost: parts[1] === 'status',
    }
  }
  return { kind: 'link', url: url.toString() }
}

export const LANGUAGE_LABEL: Record<string, string> = {
  text: 'texto',
  bash: 'bash',
  typescript: 'TypeScript',
  javascript: 'JavaScript',
  tsx: 'TSX',
  json: 'JSON',
  python: 'Python',
  go: 'Go',
  php: 'PHP',
  sql: 'SQL',
  yaml: 'YAML',
  dockerfile: 'Dockerfile',
  html: 'HTML',
  css: 'CSS',
  markdown: 'Markdown',
}

/**
 * URL pública do site, lida em runtime (acesso por colchete pra o Next não
 * congelar o valor do build na imagem Docker).
 */
export function siteUrl(env: Record<string, string | undefined> = process.env): string {
  const key = 'NEXT_PUBLIC_SERVER_URL'
  return (env[key] || 'http://localhost:3130').replace(/\/+$/, '')
}

export function absoluteUrl(path: string, base?: string): string {
  const root = (base || siteUrl()).replace(/\/+$/, '')
  return `${root}${path.startsWith('/') ? path : `/${path}`}`
}
