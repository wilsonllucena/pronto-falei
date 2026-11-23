import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { PostDate } from '@/components/site/PostBits'
import { Highlighted } from '@/components/site/Highlighted'
import { SearchForm } from '@/components/site/SearchForm'
import { plural } from '@/lib/dates'
import { getAllTags, searchPosts } from '@/lib/queries'
import { normalizeQuery } from '@/lib/search'
import { pageNumber, tagHref } from '@/lib/site'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const q = normalizeQuery((await searchParams).q)
  return {
    title: q ? `Busca: ${q}` : 'Busca',
    description: 'Busque nos textos do Pronto, Falei!',
    // resultado de busca não entra no índice dos buscadores
    robots: { index: false, follow: true },
  }
}

export default async function SearchPage({ searchParams }: Props) {
  const params = await searchParams
  const q = normalizeQuery(params.q)
  const requested = pageNumber(params.pagina)
  const [{ results, total, page, totalPages }, tags] = await Promise.all([
    q
      ? searchPosts(q, requested)
      : Promise.resolve({ results: [], total: 0, page: 1, totalPages: 1 }),
    getAllTags(),
  ])
  const href = (n: number) => `/busca?q=${encodeURIComponent(q)}${n > 1 ? `&pagina=${n}` : ''}`

  return (
    <div className="container container--narrow">
      <header className="page-head">
        <h1 className="page-head__title">Busca</h1>
        <p className="page-head__lead">
          Procure por título, assunto ou tag. Dica: aperte <kbd>/</kbd> em qualquer página.
        </p>
      </header>
      <section className="section search" aria-label="Busca">
        <SearchForm defaultValue={q} autoFocus={!q} />
        {q && (
          <p className="search__status" role="status">
            {total
              ? `${plural(total, 'resultado', 'resultados')} para “${q}”`
              : `Nada encontrado para “${q}”.`}
          </p>
        )}
        {results.length > 0 && (
          <ol className="search__results">
            {results.map((r) => (
              <li key={r.slug} className="search__item">
                <h2 className="search__title">
                  <Link href={r.href}>
                    <Highlighted segments={r.title} />
                  </Link>
                </h2>
                <p className="search__snippet">
                  <Highlighted segments={r.snippet} />
                </p>
                {r.publishedAt && (
                  <p className="row__meta">
                    <PostDate value={r.publishedAt} />
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
        {totalPages > 1 && (
          <nav className="pager" aria-label="Paginação">
            {page > 1 ? (
              <Link href={href(page - 1)} rel="prev" className="btn btn--ghost">
                ← Anteriores
              </Link>
            ) : (
              <span />
            )}
            <span className="pager__info">
              Página {page} de {totalPages}
            </span>
            {page < totalPages ? (
              <Link href={href(page + 1)} rel="next" className="btn btn--ghost">
                Próximos →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
        {(!q || total === 0) && tags.length > 0 && (
          <div className="search__suggest">
            <h2 className="eyebrow">{q ? 'Que tal uma tag?' : 'Ou navegue pelas tags'}</h2>
            <ul className="tag-list">
              {tags.map((t) => (
                <li key={t.slug}>
                  <Link href={tagHref(t.slug)} className="tag">
                    #{t.slug}
                    <span className="tag__count">{t.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  )
}
