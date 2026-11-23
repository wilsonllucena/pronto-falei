import React from 'react'

import type { TocItem } from '@/lib/post'

import { TocSpy } from './TocSpy'

function TocList({ items }: { items: TocItem[] }) {
  return (
    <ol className="toc__list">
      {items.map((i) => (
        <li key={i.id} className={`toc__item toc__item--h${i.level}`}>
          <a href={`#${i.id}`} data-toc-link={i.id}>
            {i.text}
          </a>
        </li>
      ))}
    </ol>
  )
}

/** "Índice ▾" recolhido, no mobile e em telas estreitas. */
export function TocMobile({ items }: { items: TocItem[] }) {
  if (items.length < 2) return null
  return (
    <details className="toc toc--mobile">
      <summary>Índice</summary>
      <nav aria-label="Índice do post">
        <TocList items={items} />
      </nav>
    </details>
  )
}

/** "Nesta página": fixo ao lado do texto no desktop. */
export function TocSide({ items }: { items: TocItem[] }) {
  if (items.length < 2) return null
  return (
    <nav className="toc toc--side" aria-label="Nesta página">
      <p className="toc__title">Nesta página</p>
      <TocList items={items} />
      <TocSpy ids={items.map((i) => i.id)} />
    </nav>
  )
}
