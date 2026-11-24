import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { plural } from '@/lib/dates'
import { getAllTags } from '@/lib/queries'
import { tagHref } from '@/lib/site'
import { pageMeta } from '@/lib/pageMeta'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Tags',
  description: 'Todos os assuntos do Pronto, Falei!, com a quantidade de textos de cada um.',
  ...pageMeta('/tags'),
}

/** Peso visual da tag na nuvem (1 a 4), proporcional à contagem. */
function weight(count: number, max: number): number {
  if (max <= 1) return 2
  return 1 + Math.round(((count - 1) / (max - 1)) * 3)
}

export default async function TagsPage() {
  const tags = await getAllTags()
  const max = Math.max(1, ...tags.map((t) => t.count))
  return (
    <div className="container container--narrow">
      <header className="page-head">
        <p className="eyebrow">Assuntos</p>
        <h1 className="page-head__title">Tags</h1>
        <p className="page-head__lead">
          {tags.length ? plural(tags.length, 'tag', 'tags') : 'Nenhuma tag ainda'}, da mais usada
          pra menos.
        </p>
      </header>
      <section className="section" aria-label="Todas as tags">
        {tags.length ? (
          <ul className="tag-cloud">
            {tags.map((t) => (
              <li key={t.slug}>
                <Link
                  href={tagHref(t.slug)}
                  className={`tag-cloud__item tag-cloud__item--${weight(t.count, max)}`}
                >
                  <span className="tag-cloud__name">#{t.slug}</span>
                  <span className="tag-cloud__count">{plural(t.count, 'texto', 'textos')}</span>
                  {t.description && <span className="tag-cloud__desc">{t.description}</span>}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty">Nada por aqui ainda.</p>
        )}
      </section>
    </div>
  )
}
