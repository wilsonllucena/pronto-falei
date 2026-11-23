import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { SearchForm } from '@/components/site/SearchForm'
import { getSiteChrome } from '@/lib/queries'
import { tagHref } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Página não encontrada',
  robots: { index: false, follow: true },
}

export default async function NotFound() {
  const { popularTags } = await getSiteChrome()
  return (
    <div className="container container--narrow not-found">
      <header className="page-head">
        <p className="not-found__code" aria-hidden="true">
          404
        </p>
        <h1 className="page-head__title">Essa página não existe.</h1>
        <p className="page-head__lead">
          O link pode ter mudado ou o texto saiu do ar. Pronto, falei. Mas dá pra procurar:
        </p>
      </header>
      <section className="section section--tight" aria-label="Buscar">
        <SearchForm />
      </section>
      <nav className="not-found__links" aria-label="Sugestões">
        <Link href="/" className="btn">
          Ir pra home
        </Link>
        <Link href="/blog" className="btn btn--ghost">
          Últimos textos
        </Link>
        <Link href="/arquivo" className="btn btn--ghost">
          Arquivo
        </Link>
      </nav>
      {popularTags.length > 0 && (
        <div className="not-found__tags">
          <h2 className="eyebrow">Ou por assunto</h2>
          <ul className="tag-list">
            {popularTags.map((t) => (
              <li key={t.slug}>
                <Link href={tagHref(t.slug)} className="tag">
                  #{t.slug}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
