/* eslint-disable @next/next/no-img-element -- capa em WebP nos tamanhos do Payload */
import Link from 'next/link'
import React from 'react'

import { PostDate, ReadingTime, TagChips } from '@/components/site/PostBits'
import type { PostCard } from '@/lib/site'
import type { Media } from '@/payload-types'

type Props = { card: PostCard; coverMedia: Media | null }

export function PostHeader({ card, coverMedia }: Props) {
  const hero = coverMedia?.sizes?.hero?.url ? coverMedia.sizes.hero : null
  return (
    <header className="post-head">
      <p className="post-head__top">
        <Link href="/blog" className="post-head__back">
          ← Blog
        </Link>
        {card.category && <span className="post-head__cat">{card.category.name}</span>}
      </p>
      <h1 className="post-head__title">{card.title}</h1>
      {card.subtitle && <p className="post-head__subtitle">{card.subtitle}</p>}
      <div className="post-head__meta">
        <PostDate value={card.publishedAt} />
        {card.readingTime ? (
          <>
            <span aria-hidden="true">·</span>
            <ReadingTime minutes={card.readingTime} />
            <span className="sr-only"> de leitura</span>
          </>
        ) : null}
        <TagChips tags={card.tags} max={6} />
      </div>
      {card.cover && (
        <figure className="post-head__cover">
          <img
            src={hero?.url ?? card.cover.src}
            srcSet={card.cover.srcSet}
            sizes="(min-width: 1080px) 1016px, 100vw"
            width={hero?.width ?? card.cover.width}
            height={hero?.height ?? card.cover.height}
            alt={card.cover.alt}
            fetchPriority="high"
            decoding="async"
          />
          {(coverMedia?.caption || coverMedia?.credit) && (
            <figcaption>
              {coverMedia?.caption}
              {coverMedia?.credit && (
                <span className="figure__credit"> Crédito: {coverMedia.credit}</span>
              )}
            </figcaption>
          )}
        </figure>
      )}
    </header>
  )
}
