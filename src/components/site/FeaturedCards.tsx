import Link from 'next/link'
import React from 'react'

import type { PostCard } from '@/lib/site'

import { FeaturedCarousel } from './FeaturedCarousel'
import { Cover, PostDate, ReadingTime, TagChips } from './PostBits'

export function FeaturedCards({ posts }: { posts: PostCard[] }) {
  if (!posts.length) return null
  return (
    <section className="section" aria-labelledby="destaques">
      <div className="section__head">
        <h2 id="destaques" className="section__title">
          Em destaque
        </h2>
      </div>
      <FeaturedCarousel count={posts.length}>
        {posts.map((p, i) => (
          <article key={p.id} className="card">
            {p.cover && (
              <Link href={p.href} className="card__media" tabIndex={-1} aria-hidden="true">
                <Cover image={p.cover} sizes="(min-width: 760px) 240px, 85vw" priority={i === 0} />
              </Link>
            )}
            <div className="card__body">
              <p className="meta">
                <PostDate value={p.publishedAt} />
                {p.category && <span className="meta__cat">{p.category.name}</span>}
              </p>
              <h3 className="card__title">
                <Link href={p.href}>{p.title}</Link>
              </h3>
              <p className="card__summary">{p.summary}</p>
              <div className="card__foot">
                <TagChips tags={p.tags} max={2} />
                <ReadingTime minutes={p.readingTime} />
              </div>
            </div>
          </article>
        ))}
      </FeaturedCarousel>
    </section>
  )
}
