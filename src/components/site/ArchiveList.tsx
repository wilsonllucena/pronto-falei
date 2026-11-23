import Link from 'next/link'
import React from 'react'

import { groupByYear, plural } from '@/lib/dates'
import type { ArchiveItem } from '@/lib/queries'
import { categoryHref } from '@/lib/site'

import { PostDate, ReadingTime } from './PostBits'

/** Lista compacta: ano › mês › título (arquivo, tags e categorias). */
export function ArchiveList({
  items,
  showCategory = true,
}: {
  items: ArchiveItem[]
  showCategory?: boolean
}) {
  return (
    <div className="archive">
      {groupByYear(items, (p) => p.publishedAt).map((y) => (
        <section key={y.year} className="archive__year" aria-labelledby={`ano-${y.year}`}>
          <h2 id={`ano-${y.year}`} className="archive__year-title">
            {y.year}
            <span className="archive__count">{plural(y.count, 'texto', 'textos')}</span>
          </h2>
          {y.months.map((m) => (
            <section key={m.key} className="archive__month" aria-label={m.label}>
              <h3 className="archive__month-title">{m.label.replace(/ de \d{4}$/, '')}</h3>
              <ul className="archive__items">
                {m.items.map((p) => (
                  <li key={p.slug} className="archive__item">
                    <PostDate value={p.publishedAt} short />
                    <Link href={p.href} className="archive__title">
                      {p.title}
                    </Link>
                    <span className="archive__meta">
                      {showCategory && p.category && (
                        <Link href={categoryHref(p.category.slug)} className="meta__cat">
                          {p.category.name}
                        </Link>
                      )}
                      <ReadingTime minutes={p.readingTime} />
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </section>
      ))}
    </div>
  )
}
