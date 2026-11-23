import Link from 'next/link'
import React from 'react'

import { groupByMonth, plural } from '@/lib/dates'
import type { PostCard } from '@/lib/site'

import { Cover, PostDate, ReadingTime, TagChips } from './PostBits'

/** Posts agrupados por mês (estilo Akita). Em "Grade" o mesmo HTML vira cards. */
export function PostList({ posts, id }: { posts: PostCard[]; id: string }) {
  const groups = groupByMonth(posts, (p) => p.publishedAt)
  return (
    <div id={id} className="post-list" data-view="lista">
      {groups.map((g) => (
        <section key={g.key} className="month" aria-label={g.label}>
          <h3 className="month__head">
            <span className="month__label">{g.label}</span>
            <span className="month__rule" aria-hidden="true" />
            <span className="month__count">{plural(g.items.length, 'texto', 'textos')}</span>
          </h3>
          <ul className="month__items">
            {g.items.map((p) => (
              <li key={p.id}>
                <article className="row">
                  {p.cover && (
                    <Link href={p.href} className="row__media" tabIndex={-1} aria-hidden="true">
                      <Cover image={p.cover} sizes="(min-width: 760px) 240px, 92vw" />
                    </Link>
                  )}
                  <PostDate value={p.publishedAt} short />
                  <div className="row__main">
                    <h4 className="row__title">
                      <Link href={p.href}>{p.title}</Link>
                    </h4>
                    {p.subtitle && <p className="row__subtitle">{p.subtitle}</p>}
                    <p className="row__summary">{p.summary}</p>
                    <p className="row__meta">
                      {p.category && <span className="meta__cat">{p.category.name}</span>}
                      <ReadingTime minutes={p.readingTime} />
                    </p>
                  </div>
                  <div className="row__tags">
                    <TagChips tags={p.tags} />
                  </div>
                </article>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
