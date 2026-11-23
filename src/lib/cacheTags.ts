/** Tags do cache de dados do Next (ISR sob demanda). */
export const CACHE_TAGS = {
  /** Qualquer lista de posts: home, /blog, relacionados, tags populares */
  posts: 'posts',
  /** Um post específico */
  post: (slug: string) => `post:${slug}`,
  /** Header, footer e configurações do site */
  site: 'site',
  /** Feeds, sitemap, llms.txt (rotas do passo 7) */
  feeds: 'feeds',
  /** Páginas editáveis (Sobre e afins) */
  pages: 'pages',
  /** Redirecionamentos 301/302 */
  redirects: 'redirects',
} as const

type PostLike = { slug?: string | null } | null | undefined

/** Tags a invalidar quando um post muda (inclui o slug antigo, se trocou). */
export function postChangeTags(doc: PostLike, previousDoc?: PostLike): string[] {
  const tags = new Set<string>([CACHE_TAGS.posts, CACHE_TAGS.feeds])
  for (const d of [doc, previousDoc]) if (d?.slug) tags.add(CACHE_TAGS.post(d.slug))
  return [...tags]
}
