import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { plural } from '@/lib/dates'
import { getAllCategories } from '@/lib/queries'
import { categoryHref } from '@/lib/site'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Categorias',
  description: 'Os tipos de texto do Pronto, Falei!: opinião, tutorial, diário e afins.',
  alternates: { canonical: '/categorias' },
}

export default async function CategoriesPage() {
  const cats = (await getAllCategories()).filter((c) => c.count > 0)
  return (
    <div className="container container--narrow">
      <header className="page-head">
        <p className="eyebrow">Tipos de texto</p>
        <h1 className="page-head__title">Categorias</h1>
      </header>
      <section className="section" aria-label="Categorias">
        <ul className="cat-grid">
          {cats.map((c) => (
            <li key={c.slug}>
              <Link
                href={categoryHref(c.slug)}
                className="cat-card"
                style={c.color ? ({ '--cat': c.color } as React.CSSProperties) : undefined}
              >
                <span className="cat-card__name">{c.name}</span>
                <span className="cat-card__count">{plural(c.count, 'texto', 'textos')}</span>
                {c.description && <span className="cat-card__desc">{c.description}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
