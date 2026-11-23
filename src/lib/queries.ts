/** Queries do front (servidor). Só posts publicados, do mais novo pro mais antigo. */
import config from '@payload-config'
import { getPayload, type Where } from 'payload'
import { cache } from 'react'

import type { Post } from '../payload-types'
import { cached } from './cache'
import { CACHE_TAGS } from './cacheTags'
import { pickRelated } from './post'
import { normalizePath, redirectTarget, type RedirectDoc } from './redirects'
import {
  accentInsensitivePattern,
  foldText,
  highlight,
  normalizeQuery,
  SEARCH_PAGE_SIZE,
  searchTerms,
  snippet,
  type Segment,
} from './search'
import { SEARCH_SLUG } from '../plugins/search'
import {
  DEFAULT_FOOTER_NAV,
  DEFAULT_HEADER_NAV,
  navOrFallback,
  postHref,
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

/* ------------------------------------------------------------------ */
/* Passo 6: tags, categorias, arquivo, sobre, páginas, busca e redirects */
/* ------------------------------------------------------------------ */

export type TaxonomyCount = {
  name: string
  slug: string
  description: string | null
  count: number
  color?: string | null
}

/** Todas as tags com pelo menos um post publicado, da mais usada pra menos. */
export const getAllTags = cached(
  async (): Promise<TaxonomyCount[]> => {
    const payload = await payloadClient()
    const [tags, posts] = await Promise.all([
      payload.find({ collection: 'tags', depth: 0, pagination: false, sort: 'name' }),
      payload.find({
        collection: 'posts',
        where: published,
        depth: 0,
        pagination: false,
        select: { tags: true },
      }),
    ])
    const counts = new Map<string, number>()
    for (const p of posts.docs)
      for (const t of p.tags ?? []) {
        const id = typeof t === 'string' ? t : t.id
        counts.set(id, (counts.get(id) ?? 0) + 1)
      }
    return tags.docs
      .map((t) => ({
        name: t.name,
        slug: t.slug,
        description: t.description ?? null,
        count: counts.get(t.id) ?? 0,
      }))
      .filter((t) => t.count > 0)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'pt-BR'))
  },
  'all-tags',
  () => [CACHE_TAGS.posts],
)

/** Todas as categorias com a contagem de posts publicados (inclusive zeradas). */
export const getAllCategories = cached(
  async (): Promise<TaxonomyCount[]> => {
    const payload = await payloadClient()
    const [cats, posts] = await Promise.all([
      payload.find({ collection: 'categories', depth: 0, pagination: false, sort: 'name' }),
      payload.find({
        collection: 'posts',
        where: published,
        depth: 0,
        pagination: false,
        select: { category: true },
      }),
    ])
    const counts = new Map<string, number>()
    for (const p of posts.docs) {
      const id = typeof p.category === 'string' ? p.category : p.category?.id
      if (id) counts.set(id, (counts.get(id) ?? 0) + 1)
    }
    return cats.docs.map((c) => ({
      name: c.name,
      slug: c.slug,
      description: c.description ?? null,
      color: c.color ?? null,
      count: counts.get(c.id) ?? 0,
    }))
  },
  'all-categories',
  () => [CACHE_TAGS.posts],
)

type TaxonomyPage = {
  name: string
  slug: string
  description: string | null
  color?: string | null
  posts: PostCard[]
}

/** Página de uma tag: dados da tag e os posts publicados, do mais novo pro mais antigo. */
export const getTagPage = cached(
  async (slug: string): Promise<TaxonomyPage | null> => {
    const payload = await payloadClient()
    const tag = (
      await payload.find({
        collection: 'tags',
        where: { slug: { equals: slug } },
        limit: 1,
        depth: 0,
      })
    ).docs[0]
    if (!tag) return null
    const posts = await payload.find({
      collection: 'posts',
      where: { and: [published, { tags: { contains: tag.id } }] },
      sort: '-publishedAt',
      pagination: false,
      depth: 1,
    })
    return {
      name: tag.name,
      slug: tag.slug,
      description: tag.description ?? null,
      posts: posts.docs.map((d) => toPostCard(d as Post)),
    }
  },
  'tag-page',
  () => [CACHE_TAGS.posts],
)

/** Página de uma categoria. */
export const getCategoryPage = cached(
  async (slug: string): Promise<TaxonomyPage | null> => {
    const payload = await payloadClient()
    const cat = (
      await payload.find({
        collection: 'categories',
        where: { slug: { equals: slug } },
        limit: 1,
        depth: 0,
      })
    ).docs[0]
    if (!cat) return null
    const posts = await payload.find({
      collection: 'posts',
      where: { and: [published, { category: { equals: cat.id } }] },
      sort: '-publishedAt',
      pagination: false,
      depth: 1,
    })
    return {
      name: cat.name,
      slug: cat.slug,
      description: cat.description ?? null,
      color: cat.color ?? null,
      posts: posts.docs.map((d) => toPostCard(d as Post)),
    }
  },
  'category-page',
  () => [CACHE_TAGS.posts],
)

export type ArchiveItem = {
  slug: string
  href: string
  title: string
  publishedAt: string
  readingTime: number | null
  category: { name: string; slug: string } | null
}

/** Arquivo: todos os publicados (só o necessário), opcionalmente de uma categoria. */
export const getArchive = cached(
  async (categorySlug: string | null): Promise<ArchiveItem[]> => {
    const payload = await payloadClient()
    const res = await payload.find({
      collection: 'posts',
      where: published,
      sort: '-publishedAt',
      pagination: false,
      depth: 1,
      select: { title: true, slug: true, publishedAt: true, readingTime: true, category: true },
      populate: { categories: { name: true, slug: true } },
    })
    return res.docs
      .map((d) => {
        const post = d as Post
        const cat =
          post.category && typeof post.category === 'object'
            ? { name: post.category.name, slug: post.category.slug }
            : null
        return {
          slug: post.slug,
          href: postHref(post.slug),
          title: post.title,
          publishedAt: post.publishedAt ?? post.createdAt,
          readingTime: post.readingTime ?? null,
          category: cat,
        }
      })
      .filter((p) => !categorySlug || p.category?.slug === categorySlug)
  },
  'archive',
  () => [CACHE_TAGS.posts],
)

export type AuthorInfo = {
  name: string
  role: string
  bio: string | null
  email: string | null
  photo: { src: string; width: number; height: number; alt: string } | null
  social: { network: string; url: string }[]
}

export type PageDoc = NonNullable<Awaited<ReturnType<typeof loadPage>>>

async function loadPage(slug: string) {
  const payload = await payloadClient()
  const res = await payload.find({
    collection: 'pages',
    where: { and: [published, { slug: { equals: slug } }] },
    limit: 1,
    depth: 2,
  })
  return res.docs[0] ?? null
}

/** Página editável publicada (Sobre, Uses, Contato...). */
export const getPublishedPage = cached(loadPage, 'page', () => [CACHE_TAGS.pages])

/** Dados do /sobre: a Page "sobre" (se publicada) e o autor das configurações. */
export const getAboutData = cached(
  async (): Promise<{ page: PageDoc | null; author: AuthorInfo }> => {
    const payload = await payloadClient()
    const [page, settings] = await Promise.all([
      loadPage('sobre'),
      payload.findGlobal({ slug: 'site-settings', depth: 1 }),
    ])
    const a = settings.author ?? {}
    const photo = a.photo && typeof a.photo === 'object' ? a.photo : null
    const square = photo?.sizes?.thumb?.url ? photo.sizes.thumb : null
    return {
      page,
      author: {
        name: a.name || 'Wilson Lima',
        role: a.role || 'Engenheiro de software fullstack em Brasília',
        bio: a.bio || null,
        email: a.email || null,
        photo:
          photo && (square?.url || photo.url)
            ? {
                src: (square?.url || photo.url)!,
                width: square?.width ?? photo.width ?? 320,
                height: square?.height ?? photo.height ?? 320,
                alt: photo.alt || a.name || 'Foto do autor',
              }
            : null,
        social: (settings.social ?? []).map((s) => ({ network: s.network, url: s.url })),
      },
    }
  },
  'about',
  () => [CACHE_TAGS.pages, CACHE_TAGS.site],
)

/** Redirecionamento cadastrado pra esse caminho (já com o destino resolvido). */
export const findRedirect = cached(
  async (path: string): Promise<{ to: string; permanent: boolean } | null> => {
    const from = normalizePath(path)
    if (!from || from === '/') return null
    const payload = await payloadClient()
    const res = await payload.find({
      collection: 'redirects',
      where: { from: { equals: from } },
      limit: 1,
      depth: 1,
    })
    const doc = res.docs[0]
    return doc ? redirectTarget(doc as RedirectDoc) : null
  },
  'redirect',
  () => [CACHE_TAGS.redirects, CACHE_TAGS.posts, CACHE_TAGS.pages],
)

export type SearchResult = {
  slug: string
  href: string
  title: Segment[]
  snippet: Segment[]
  publishedAt: string | null
}

type SearchRow = {
  title?: string
  slug?: string
  subtitle?: string
  summary?: string
  body?: string
  publishedAt?: Date | string
}

type MongoModel = {
  countDocuments: (filter: object) => Promise<number>
  find: (
    filter: object,
    projection?: object,
  ) => {
    sort: (s: object) => {
      skip: (n: number) => { limit: (n: number) => { lean: () => Promise<SearchRow[]> } }
    }
  }
}

/**
 * Busca nos posts publicados: primeiro pelo índice de texto em português do
 * Mongo (radical, sem acento, com peso no título); se não achar nada, tenta
 * pedaço de palavra ("home" acha "homelab").
 */
export async function searchPosts(
  query: string,
  page = 1,
): Promise<{ results: SearchResult[]; total: number; page: number; totalPages: number }> {
  const q = normalizeQuery(query)
  const terms = searchTerms(q)
  const empty = { results: [], total: 0, page: 1, totalPages: 1 }
  if (!q || !terms.length) return empty
  const payload = await payloadClient()
  const Model = (payload.db as unknown as { collections: Record<string, MongoModel> }).collections[
    SEARCH_SLUG
  ]
  const fields = { title: 1, slug: 1, subtitle: 1, summary: 1, body: 1, publishedAt: 1 }
  const skip = (Math.max(1, page) - 1) * SEARCH_PAGE_SIZE

  let filter: object = { $text: { $search: q } }
  let sort: object = { score: { $meta: 'textScore' }, publishedAt: -1 }
  let projection: object = { ...fields, score: { $meta: 'textScore' } }
  let total = await Model.countDocuments(filter)
  if (total === 0) {
    const anyField = (t: string) => {
      const re = { $regex: accentInsensitivePattern(t), $options: 'i' }
      return { $or: ['title', 'subtitle', 'summary', 'tagNames', 'body'].map((f) => ({ [f]: re })) }
    }
    filter = { $and: terms.map(anyField) }
    sort = { publishedAt: -1 }
    projection = fields
    total = await Model.countDocuments(filter)
  }
  if (total === 0) return { ...empty, page: 1 }
  const rows = await Model.find(filter, projection)
    .sort(sort)
    .skip(skip)
    .limit(SEARCH_PAGE_SIZE)
    .lean()
  const results = rows
    .filter((r) => r.slug && r.title)
    .map((r) => {
      const body = r.body ?? ''
      const folded = foldText(body)
      const inBody = terms.some((t) => folded.includes(t))
      return {
        slug: r.slug!,
        href: postHref(r.slug!),
        title: highlight(r.title!, terms),
        snippet: snippet(inBody ? body : r.summary || r.subtitle || body, terms),
        publishedAt: r.publishedAt ? new Date(r.publishedAt).toISOString() : null,
      }
    })
  return {
    results,
    total,
    page: Math.max(1, page),
    totalPages: Math.max(1, Math.ceil(total / SEARCH_PAGE_SIZE)),
  }
}
