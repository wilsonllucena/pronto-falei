import { describe, expect, it } from 'vitest'

import type { Post } from '@/payload-types'
import { pickRelated } from '@/lib/post'
import { buildSeriesNav } from '@/lib/series'

const p = (id: string, status: 'published' | 'draft' = 'published') =>
  ({ id, title: `Post ${id}`, slug: `post-${id}`, _status: status }) as Post
const serie = (posts: (Post | string)[]) => ({
  title: 'Homelab do zero',
  slug: 'homelab-do-zero',
  description: 'Do mini PC ao blog.',
  posts,
})

describe('navegação de série', () => {
  it('parte do meio: posição, lista na ordem salva, anterior e próxima', () => {
    const nav = buildSeriesNav(serie([p('c'), p('a'), p('b')]), 'a')!
    expect(nav.index).toBe(2)
    expect(nav.total).toBe(3)
    expect(nav.parts.map((x) => x.id)).toEqual(['c', 'a', 'b'])
    expect(nav.parts.find((x) => x.current)?.id).toBe('a')
    expect(nav.prev?.href).toBe('/posts/post-c')
    expect(nav.next?.href).toBe('/posts/post-b')
    expect(nav.title).toBe('Homelab do zero')
  })

  it('primeira não tem anterior; última não tem próxima', () => {
    const s = serie([p('a'), p('b'), p('c')])
    expect(buildSeriesNav(s, 'a')?.prev).toBeNull()
    expect(buildSeriesNav(s, 'a')?.next?.id).toBe('b')
    expect(buildSeriesNav(s, 'c')?.next).toBeNull()
    expect(buildSeriesNav(s, 'c')?.prev?.id).toBe('b')
  })

  it('rascunhos, ids soltos e repetidos ficam de fora da contagem', () => {
    const nav = buildSeriesNav(serie([p('a'), p('x', 'draft'), 'solto', p('b'), p('a')]), 'b')!
    expect(nav.parts.map((x) => x.id)).toEqual(['a', 'b'])
    expect(nav.index).toBe(2)
    expect(nav.total).toBe(2)
    expect(nav.prev?.id).toBe('a')
  })

  it('sem o post na lista ou com uma parte só, não há série', () => {
    expect(buildSeriesNav(serie([p('a'), p('b')]), 'z')).toBeNull()
    expect(buildSeriesNav(serie([p('a'), p('x', 'draft')]), 'a')).toBeNull()
    expect(buildSeriesNav(serie([]), 'a')).toBeNull()
  })
})

describe('relacionados por tags e categoria', () => {
  const tag = (id: string) => ({ id, name: id, slug: id })
  const post = (id: string, tags: string[], category: string | null, publishedAt: string) =>
    ({
      id,
      tags: tags.map(tag),
      category: category ? { id: category, name: category, slug: category } : null,
      publishedAt,
      _status: 'published',
    }) as unknown as Post

  it('tag em comum pesa mais que categoria; categoria desempata e completa', () => {
    const current = post('p0', ['ia'], 'tutorial', '2026-11-20')
    const pool = [
      post('so-categoria-novo', [], 'tutorial', '2026-11-19'),
      post('tag-e-categoria', ['ia'], 'tutorial', '2026-01-01'),
      post('so-tag', ['ia'], 'opiniao', '2026-11-10'),
      post('nada', ['carreira'], 'opiniao', '2026-11-18'),
    ]
    expect(pickRelated(current, pool).map((x) => x.id)).toEqual([
      'tag-e-categoria',
      'so-tag',
      'so-categoria-novo',
    ])
  })

  it('post sem tags ainda acha relacionados pela categoria', () => {
    const current = post('p0', [], 'diario', '2026-11-20')
    const pool = [
      post('d1', [], 'diario', '2026-10-01'),
      post('o1', ['ia'], 'opiniao', '2026-11-01'),
    ]
    expect(pickRelated(current, pool).map((x) => x.id)).toEqual(['d1'])
  })

  it('aceita a categoria como id (sem populate)', () => {
    const current = { ...post('p0', [], null, '2026-11-20'), category: 'diario' } as Post
    const pool = [{ ...post('d1', [], null, '2026-10-01'), category: 'diario' } as Post]
    expect(pickRelated(current, pool).map((x) => x.id)).toEqual(['d1'])
  })
})
