import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { ArchiveList } from '@/components/site/ArchiveList'
import { plural } from '@/lib/dates'
import { redirectOrNotFound } from '@/lib/notFound'
import { getCategoryPage } from '@/lib/queries'
import { categoryHref } from '@/lib/site'
import { pageMeta } from '@/lib/pageMeta'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const cat = await getCategoryPage(slug)
  if (!cat) return { title: 'Categoria não encontrada' }
  return {
    title: cat.name,
    description: cat.description || `Textos da categoria ${cat.name} no Pronto, Falei!`,
    ...pageMeta(categoryHref(cat.slug)),
  }
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params
  const cat = await getCategoryPage(slug)
  if (!cat) return redirectOrNotFound(categoryHref(slug))
  return (
    <div className="container container--narrow">
      <header
        className="page-head page-head--cat"
        style={cat.color ? ({ '--cat': cat.color } as React.CSSProperties) : undefined}
      >
        <p className="eyebrow">
          <Link href="/categorias">← Categorias</Link>
        </p>
        <h1 className="page-head__title">{cat.name}</h1>
        <p className="page-head__lead">
          {plural(cat.posts.length, 'texto', 'textos')}
          {cat.description ? ` · ${cat.description}` : ''}
        </p>
      </header>
      <section className="section" aria-label={`Textos da categoria ${cat.name}`}>
        {cat.posts.length ? (
          <ArchiveList items={cat.posts} showCategory={false} />
        ) : (
          <p className="empty">Nenhum texto publicado nessa categoria ainda.</p>
        )}
      </section>
    </div>
  )
}
