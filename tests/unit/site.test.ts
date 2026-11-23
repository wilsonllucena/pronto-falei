import { describe, expect, it } from 'vitest'

import {
  cardImage,
  DEFAULT_FOOTER_NAV,
  DEFAULT_HEADER_NAV,
  isExternal,
  navOrFallback,
  pageNumber,
  rankTags,
  toPostCard,
} from '@/lib/site'
import type { Media, Post } from '@/payload-types'

const tag = (slug: string, name = slug) =>
  ({ id: slug, slug, name, createdAt: '', updatedAt: '' }) as never

const media = {
  id: 'm1',
  alt: 'Capa de teste',
  url: 'http://img/media/capa.png',
  width: 1600,
  height: 960,
  sizes: {
    thumb: { url: 'http://img/media/capa-400x240.webp', width: 400, height: 240 },
    card: { url: 'http://img/media/capa-800x480.webp', width: 800, height: 480 },
    hero: { url: 'http://img/media/capa-1600x960.webp', width: 1600, height: 960 },
  },
} as unknown as Media

const post = {
  id: 'p1',
  slug: 'meu-post',
  title: 'Meu post',
  subtitle: 'Linha fina',
  summary: 'Resumo',
  publishedAt: '2026-11-20T12:00:00.000Z',
  createdAt: '2026-11-19T12:00:00.000Z',
  readingTime: 6,
  category: { id: 'c1', name: 'Opinião', slug: 'opiniao' },
  tags: [tag('ia', 'IA'), 'id-solto'],
  cover: media,
} as unknown as Post

describe('cards de post', () => {
  it('monta o card com link, categoria, tags e capa', () => {
    const card = toPostCard(post)
    expect(card).toMatchObject({
      href: '/posts/meu-post',
      title: 'Meu post',
      subtitle: 'Linha fina',
      readingTime: 6,
      category: { name: 'Opinião', slug: 'opiniao' },
      tags: [{ name: 'IA', slug: 'ia' }],
    })
    expect(card.cover).toEqual({
      src: 'http://img/media/capa-800x480.webp',
      srcSet:
        'http://img/media/capa-400x240.webp 400w, http://img/media/capa-800x480.webp 800w, http://img/media/capa-1600x960.webp 1600w',
      width: 800,
      height: 480,
      alt: 'Capa de teste',
    })
  })

  it('cai pro original e pro createdAt quando faltam dados', () => {
    const card = toPostCard({
      ...post,
      subtitle: null,
      publishedAt: null,
      category: 'id',
      tags: null,
      cover: { ...media, sizes: {} },
    } as unknown as Post)
    expect(card.publishedAt).toBe('2026-11-19T12:00:00.000Z')
    expect(card.subtitle).toBeNull()
    expect(card.category).toBeNull()
    expect(card.tags).toEqual([])
    expect(card.cover).toMatchObject({
      src: 'http://img/media/capa.png',
      width: 1600,
      srcSet: undefined,
    })
  })

  it('sem capa populada não tem imagem', () => {
    expect(cardImage('id-da-midia')).toBeNull()
    expect(cardImage(null)).toBeNull()
    expect(cardImage(media, 'thumb')?.src).toBe('http://img/media/capa-400x240.webp')
  })
})

describe('navegação e tags populares', () => {
  it('usa os itens do admin ou o padrão', () => {
    expect(navOrFallback(null, DEFAULT_HEADER_NAV)).toBe(DEFAULT_HEADER_NAV)
    expect(navOrFallback([{ label: ' ', url: '/x' }], DEFAULT_FOOTER_NAV)).toBe(DEFAULT_FOOTER_NAV)
    expect(
      navOrFallback([{ label: ' Projetos ', url: '/projetos', newTab: null }], DEFAULT_HEADER_NAV),
    ).toEqual([{ label: 'Projetos', url: '/projetos', newTab: false }])
    expect(DEFAULT_HEADER_NAV.map((i) => i.label)).toEqual(['Blog', 'Arquivo', 'Sobre'])
  })

  it('ordena as tags por uso e depois por nome', () => {
    const posts = [
      { tags: [tag('ia', 'IA'), tag('homelab', 'Homelab')] },
      { tags: [tag('ia', 'IA'), tag('carreira', 'Carreira')] },
      { tags: [tag('ia', 'IA'), 'solto'] },
      { tags: null },
    ] as never
    expect(rankTags(posts)).toEqual([
      { name: 'IA', slug: 'ia', count: 3 },
      { name: 'Carreira', slug: 'carreira', count: 1 },
      { name: 'Homelab', slug: 'homelab', count: 1 },
    ])
    expect(rankTags(posts, 1)).toHaveLength(1)
  })

  it('valida página e link externo', () => {
    expect(pageNumber('3')).toBe(3)
    expect(pageNumber(['2', '5'])).toBe(2)
    for (const bad of ['0', '-1', 'abc', '1.5', undefined]) expect(pageNumber(bad)).toBe(1)
    expect(isExternal('https://github.com/x')).toBe(true)
    expect(isExternal('/sobre')).toBe(false)
  })
})
