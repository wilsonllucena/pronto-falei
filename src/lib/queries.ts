/** Queries do front (servidor). Só posts publicados, do mais novo pro mais antigo. */
import config from '@payload-config'
import { getPayload, type Where } from 'payload'
import { cache } from 'react'

import type { Post } from '../payload-types'
import {
  DEFAULT_FOOTER_NAV,
  DEFAULT_HEADER_NAV,
  navOrFallback,
  rankTags,
  toPostCard,
  type NavLink,
  type PostCard,
  type TagCount,
} from './site'

export const FEATURED_MAX = 3
export const HOME_RECENT = 10
export const BLOG_PAGE_SIZE = 12

const published: Where = { _status: { equals: 'published' } }

const payloadClient = () => getPayload({ config })

export type SiteChrome = {
  siteName: string
  tagline: string
  header: NavLink[]
  footer: NavLink[]
  social: { network: string; url: string }[]
  popularTags: TagCount[]
}

export const DEFAULT_CHROME: SiteChrome = {
  siteName: 'Pronto, Falei!',
  tagline: 'Ideias, opiniões e descobertas, sem rodeios.',
  header: DEFAULT_HEADER_NAV,
  footer: DEFAULT_FOOTER_NAV,
  social: [],
  popularTags: [],
}

/** Header e footer não derrubam a página: se o banco falhar, usa o padrão. */
export const getSiteChrome = cache(async (): Promise<SiteChrome> => {
  try {
    return await loadSiteChrome()
  } catch (err) {
    console.error('[site] falha ao carregar header/footer, usando o padrão:', err)
    return DEFAULT_CHROME
  }
})

async function loadSiteChrome(): Promise<SiteChrome> {
  const payload = await payloadClient()
  const [settings, navigation, tagged] = await Promise.all([
    payload.findGlobal({ slug: 'site-settings', depth: 0 }),
    payload.findGlobal({ slug: 'navigation', depth: 0 }),
    payload.find({
      collection: 'posts',
      where: published,
      depth: 1,
      pagination: false,
      select: { tags: true },
    }),
  ])
  return {
    siteName: settings.siteName || 'Pronto, Falei!',
    tagline: settings.tagline || 'Ideias, opiniões e descobertas, sem rodeios.',
    header: navOrFallback(navigation.header, DEFAULT_HEADER_NAV),
    footer: navOrFallback(navigation.footer, DEFAULT_FOOTER_NAV),
    social: (settings.social ?? []).map((s) => ({ network: s.network, url: s.url })),
    popularTags: rankTags(tagged.docs as Pick<Post, 'tags'>[], 8),
  }
}

export async function getHomeData(): Promise<{
  featured: PostCard[]
  recent: PostCard[]
  total: number
}> {
  const payload = await payloadClient()
  const [featured, recent] = await Promise.all([
    payload.find({
      collection: 'posts',
      where: { and: [published, { featured: { equals: true } }] },
      sort: '-publishedAt',
      limit: FEATURED_MAX,
      depth: 1,
    }),
    payload.find({
      collection: 'posts',
      where: published,
      sort: '-publishedAt',
      limit: HOME_RECENT,
      depth: 1,
    }),
  ])
  return {
    featured: featured.docs.map((d) => toPostCard(d as Post)),
    recent: recent.docs.map((d) => toPostCard(d as Post)),
    total: recent.totalDocs,
  }
}

export async function getBlogPage(page: number): Promise<{
  posts: PostCard[]
  page: number
  totalPages: number
  total: number
}> {
  const payload = await payloadClient()
  const res = await payload.find({
    collection: 'posts',
    where: published,
    sort: '-publishedAt',
    limit: BLOG_PAGE_SIZE,
    page,
    depth: 1,
  })
  return {
    posts: res.docs.map((d) => toPostCard(d as Post)),
    page: res.page ?? page,
    totalPages: Math.max(1, res.totalPages),
    total: res.totalDocs,
  }
}
