/** Queries do front (servidor). Só posts publicados, do mais novo pro mais antigo. */
import config from '@payload-config'
import { getPayload, type Where } from 'payload'
import { cache } from 'react'

import type { Post } from '../payload-types'
import { cached } from './cache'
import { CACHE_TAGS } from './cacheTags'
import { pickRelated } from './post'
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

const loadSiteChrome = cached(loadSiteChromeUncached, 'site-chrome', () => [
  CACHE_TAGS.site,
  CACHE_TAGS.posts,
])

async function loadSiteChromeUncached(): Promise<SiteChrome> {
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

export const getHomeData = cached(getHomeDataUncached, 'home', () => [CACHE_TAGS.posts])

async function getHomeDataUncached(): Promise<{
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

export const getBlogPage = cached(getBlogPageUncached, 'blog-page', () => [CACHE_TAGS.posts])

async function getBlogPageUncached(page: number): Promise<{
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

/** Post publicado pelo slug, com conteúdo, capa, tags e relacionados populados. */
export const getPublishedPost = cached(
  async (slug: string): Promise<Post | null> => {
    const payload = await payloadClient()
    const res = await payload.find({
      collection: 'posts',
      where: { and: [published, { slug: { equals: slug } }] },
      limit: 1,
      depth: 2,
    })
    return (res.docs[0] as Post | undefined) ?? null
  },
  'post',
  (slug) => [CACHE_TAGS.post(slug), CACHE_TAGS.posts],
)

/**
 * Rascunho mais recente (pré-visualização e live preview no admin). Sem cache e
 * só pra quem está logado: quem chama confere o usuário antes.
 */
export async function getDraftPost(slugOrId: string): Promise<Post | null> {
  const payload = await payloadClient()
  const bySlug = await payload.find({
    collection: 'posts',
    where: { slug: { equals: slugOrId } },
    limit: 1,
    depth: 2,
    draft: true,
  })
  if (bySlug.docs[0]) return bySlug.docs[0] as Post
  if (!/^[a-f0-9]{24}$/.test(slugOrId)) return null
  try {
    return (await payload.findByID({
      collection: 'posts',
      id: slugOrId,
      depth: 2,
      draft: true,
    })) as Post
  } catch {
    return null
  }
}

/** "Leia também": override manual ou até 3 posts com mais tags em comum. */
export const getRelatedPosts = cached(
  async (slug: string): Promise<PostCard[]> => {
    const post = await getPublishedPost(slug)
    if (!post) return []
    const ids = (post.tags ?? []).map((t) => (typeof t === 'string' ? t : t.id))
    let candidates: Post[] = []
    if (ids.length) {
      const payload = await payloadClient()
      const res = await payload.find({
        collection: 'posts',
        where: { and: [published, { tags: { in: ids } }, { id: { not_equals: post.id } }] },
        sort: '-publishedAt',
        limit: 30,
        depth: 1,
      })
      candidates = res.docs as Post[]
    }
    return pickRelated(post, candidates, 3).map(toPostCard)
  },
  'related',
  (slug) => [CACHE_TAGS.posts, CACHE_TAGS.post(slug)],
)
