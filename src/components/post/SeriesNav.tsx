import Link from 'next/link'
import React from 'react'

import type { SeriesNav as SeriesNavData } from '@/lib/series'

/** "Parte N de M da série X" com a lista das partes e anterior/próximo. */
export function SeriesNav({ series }: { series: SeriesNavData | null }) {
  if (!series) return null
  return (
    <nav className="series" aria-labelledby="serie-titulo">
      <p className="series__eyebrow">
        Parte {series.index} de {series.total} da série
      </p>
      <h2 id="serie-titulo" className="series__title">
        {series.title}
      </h2>
      {series.description && <p className="series__desc">{series.description}</p>}
      <ol className="series__parts">
        {series.parts.map((p) => (
          <li key={p.id} className="series__part" data-current={p.current || undefined}>
            {p.current ? (
              <span aria-current="page">{p.title}</span>
            ) : (
              <Link href={p.href}>{p.title}</Link>
            )}
          </li>
        ))}
      </ol>
      <div className="series__pager">
        {series.prev ? (
          <Link className="series__link series__link--prev" href={series.prev.href} rel="prev">
            <span className="series__dir">‹ Anterior</span>
            <span className="series__name">{series.prev.title}</span>
          </Link>
        ) : (
          <span />
        )}
        {series.next ? (
          <Link className="series__link series__link--next" href={series.next.href} rel="next">
            <span className="series__dir">Próxima ›</span>
            <span className="series__name">{series.next.title}</span>
          </Link>
        ) : (
          <span />
        )}
      </div>
    </nav>
  )
}
