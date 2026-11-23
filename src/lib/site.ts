/**
 * Formato dos dados que o front usa (cards, listas, header e footer),
 * separado das queries pra dar pra testar sem banco.
 */
import type { Category, Media, Navigation, Post, Tag } from '../payload-types'

export type NavLink = { label: string; url: string; newTab: boolean }

export type CardImage = {
  src: string
  srcSet?: string
  width: number
  height: number
  alt: string
}

export type PostCard = {
  id: string
  slug: string
  href: string
  title: string
  subtitle: string | null
  summary: string
  publishedAt: string
  readingTime: number | null
  category: { name: string; slug: string } | null
  tags: { name: string; slug: string }[]
  cover: CardImage | null
}

export type TagCount = { name: string; slug: string; count: number }

export const DEFAULT_HEADER_NAV: NavLink[] = [
  { label: 'Blog', url: '/blog', newTab: false },
  { label: 'Arquivo', url: '/arquivo', newTab: false },
  { label: 'Sobre', url: '/sobre', newTab: false },
]

export const DEFAULT_FOOTER_NAV: NavLink[] = [
  { label: 'Sobre o Wilson', url: '/sobre', newTab: false },
  { label: 'RSS', url: '/feed.xml', newTab: false },
  { label: 'llms.txt', url: '/llms.txt', newTab: false },
]

export const postHref = (slug: string) => `/posts/${slug}`
export const tagHref = (slug: string) => `/tags/${slug}`

export function navOrFallback(
  items: Navigation['header'] | undefined,
  fallback: NavLink[],
): NavLink[] {
  const list = (items ?? [])
    .filter((i) => i.label?.trim() && i.url?.trim())
    .map((i) => ({ label: i.label.trim(), url: i.url.trim(), newTab: Boolean(i.newTab) }))
  return list.length ? list : fallback
}

const isObj = <T extends object>(v: unknown): v is T => typeof v === 'object' && v !== null

export function cardImage(
  media: Post['cover'],
  preferred: 'card' | 'thumb' = 'card',
): CardImage | null {
  if (!isObj<Media>(media)) return null
  const sizes = media.sizes ?? {}
  const main = sizes[preferred]?.url ? sizes[preferred] : sizes.card?.url ? sizes.card : null
  const src = main?.url ?? media.url
  if (!src) return null
  const width = main?.width ?? media.width ?? 800
  const height = main?.height ?? media.height ?? 480
  const candidates = [sizes.thumb, sizes.card, sizes.hero]
    .filter((s): s is { url: string; width: number } => Boolean(s?.url && s?.width))
    .map((s) => `${s.url} ${s.width}w`)
  return {
    src,
    srcSet: candidates.length > 1 ? candidates.join(', ') : undefined,
    width,
    height,
    alt: media.alt ?? '',
  }
}

export function toPostCard(post: Post): PostCard {
  const category = isObj<Category>(post.category)
    ? { name: post.category.name, slug: post.category.slug }
    : null
  const tags = (post.tags ?? [])
    .filter((t): t is Tag => isObj<Tag>(t))
    .map((t) => ({ name: t.name, slug: t.slug }))
  return {
    id: post.id,
    slug: post.slug,
    href: postHref(post.slug),
    title: post.title,
    subtitle: post.subtitle ?? null,
    summary: post.summary ?? '',
    publishedAt: post.publishedAt ?? post.createdAt,
    readingTime: post.readingTime ?? null,
    category,
    tags,
    cover: cardImage(post.cover),
  }
}

/** Conta posts por tag e devolve as mais usadas (empate: ordem alfabética). */
export function rankTags(posts: Pick<Post, 'tags'>[], limit = 8): TagCount[] {
  const counts = new Map<string, TagCount>()
  for (const p of posts) {
    for (const t of p.tags ?? []) {
      if (!isObj<Tag>(t)) continue
      const cur = counts.get(t.slug) ?? { name: t.name, slug: t.slug, count: 0 }
      cur.count += 1
      counts.set(t.slug, cur)
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'pt-BR'))
    .slice(0, limit)
}

export function isExternal(url: string): boolean {
  return /^https?:\/\//i.test(url)
}

export function pageNumber(value: unknown): number {
  const n = Number(Array.isArray(value) ? value[0] : value)
  return Number.isInteger(n) && n > 0 ? n : 1
}
