import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { ArchiveList } from '@/components/site/ArchiveList'
import { plural } from '@/lib/dates'
import { getAllCategories, getArchive } from '@/lib/queries'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const cat = (await searchParams).categoria
  return {
    title: 'Arquivo',
    description: 'Todos os textos do Pronto, Falei!, por ano e mês.',
    alternates: { canonical: '/arquivo' },
    // a versão filtrada não precisa ir pro índice
    robots: cat ? { index: false, follow: true } : undefined,
  }
}

export default async function ArchivePage({ searchParams }: Props) {
  const raw = (await searchParams).categoria
  const categories = (await getAllCategories()).filter((c) => c.count > 0)
  const wanted = typeof raw === 'string' ? raw : null
  const active = categories.find((c) => c.slug === wanted) ?? null
  const items = await getArchive(active?.slug ?? null)
  return (
    <div className="container container--narrow">
      <header className="page-head">
        <h1 className="page-head__title">Arquivo</h1>
        <p className="page-head__lead">
          {items.length ? plural(items.length, 'texto', 'textos') : 'Nenhum texto'}
          {active ? ` em ${active.name}` : ''}, por ano e mês.
        </p>
      </header>
      {categories.length > 0 && (
        <nav className="filter" aria-label="Filtrar por categoria">
          <Link
            href="/arquivo"
            className="filter__chip"
            aria-current={!active ? 'page' : undefined}
          >
            Todas
          </Link>
          {categories.map((c) => (
            <Link
              key={c.slug}
              href={`/arquivo?categoria=${c.slug}`}
              className="filter__chip"
              aria-current={active?.slug === c.slug ? 'page' : undefined}
            >
              {c.name} <span className="filter__count">{c.count}</span>
            </Link>
          ))}
        </nav>
      )}
      <section className="section section--tight" aria-label="Textos por ano">
        {items.length ? (
          <ArchiveList items={items} showCategory={!active} />
        ) : (
          <p className="empty">Nada por aqui ainda.</p>
        )}
      </section>
    </div>
  )
}
