import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { PostList } from '@/components/site/PostList'
import { ViewToggle } from '@/components/site/ViewToggle'
import { plural } from '@/lib/dates'
import { getBlogPage } from '@/lib/queries'
import { pageNumber } from '@/lib/site'
import { pageMeta } from '@/lib/pageMeta'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Todos os textos do Pronto, Falei!, do mais novo pro mais antigo.',
  ...pageMeta('/blog'),
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export default async function BlogPage({ searchParams }: Props) {
  const requested = pageNumber((await searchParams).pagina)
  const { posts, page, totalPages, total } = await getBlogPage(requested)
  const href = (n: number) => (n <= 1 ? '/blog' : `/blog?pagina=${n}`)
  return (
    <div className="container">
      <header className="page-head">
        <h1 className="page-head__title">Blog</h1>
        <p className="page-head__lead">
          {total ? plural(total, 'texto', 'textos') : 'Nenhum texto ainda'}, do mais novo pro mais
          antigo.
        </p>
      </header>
      <section className="section" aria-label="Textos">
        {posts.length > 0 && (
          <div className="section__head section__head--end">
            <ViewToggle target="lista-blog" />
          </div>
        )}
        {posts.length ? (
          <PostList posts={posts} id="lista-blog" />
        ) : (
          <p className="empty">Nada por aqui nessa página.</p>
        )}
        {totalPages > 1 && (
          <nav className="pager" aria-label="Paginação">
            {page > 1 ? (
              <Link href={href(page - 1)} rel="prev" className="btn btn--ghost">
                ← Mais novos
              </Link>
            ) : (
              <span />
            )}
            <span className="pager__info">
              Página {page} de {totalPages}
            </span>
            {page < totalPages ? (
              <Link href={href(page + 1)} rel="next" className="btn btn--ghost">
                Mais antigos →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </section>
    </div>
  )
}
