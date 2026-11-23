import Link from 'next/link'
import React from 'react'

import { PostDate, ReadingTime } from '@/components/site/PostBits'
import type { PostCard } from '@/lib/site'

export function Related({ posts }: { posts: PostCard[] }) {
  if (!posts.length) return null
  return (
    <section className="related" aria-labelledby="leia-tambem">
      <h2 id="leia-tambem" className="related__title">
        Leia também
      </h2>
      <ul className="related__list">
        {posts.map((p) => (
          <li key={p.id} className="related__item">
            <p className="meta">
              <PostDate value={p.publishedAt} />
              <ReadingTime minutes={p.readingTime} />
            </p>
            <h3 className="related__post">
              <Link href={p.href}>{p.title}</Link>
            </h3>
            <p className="related__summary">{p.summary}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
