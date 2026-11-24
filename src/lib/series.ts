/** Navegação de série (Parte N de M, anterior/próximo) — regra pura, sem banco. */
import type { Post, Series } from '../payload-types'
import { postHref } from './site'

export type SeriesPart = { id: string; title: string; href: string; current: boolean }

export type SeriesNav = {
  title: string
  slug: string
  description: string | null
  /** Posição do post atual, começando em 1 */
  index: number
  total: number
  parts: SeriesPart[]
  prev: SeriesPart | null
  next: SeriesPart | null
}

type SeriesLike = Pick<Series, 'title' | 'slug' | 'description' | 'posts'>

/**
 * Monta a navegação a partir da ordem salva na série, só com os posts
 * publicados. Sem o post atual na lista (ou com menos de 2 partes) não há série.
 */
export function buildSeriesNav(series: SeriesLike, currentId: string): SeriesNav | null {
  const published = (series.posts ?? []).filter(
    (p): p is Post => typeof p === 'object' && p !== null && p._status === 'published',
  )
  const seen = new Set<string>()
  const parts: SeriesPart[] = []
  for (const p of published) {
    if (seen.has(p.id)) continue
    seen.add(p.id)
    parts.push({ id: p.id, title: p.title, href: postHref(p.slug), current: p.id === currentId })
  }
  const i = parts.findIndex((p) => p.current)
  if (i < 0 || parts.length < 2) return null
  return {
    title: series.title,
    slug: series.slug ?? '',
    description: series.description ?? null,
    index: i + 1,
    total: parts.length,
    parts,
    prev: parts[i - 1] ?? null,
    next: parts[i + 1] ?? null,
  }
}
