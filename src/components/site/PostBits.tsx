/* eslint-disable @next/next/no-img-element -- imagens já saem em WebP nos tamanhos do Payload (passo 3) */
import Link from 'next/link'
import React from 'react'

import { formatDate, formatShortDate } from '@/lib/dates'
import { tagHref, type CardImage, type PostCard } from '@/lib/site'

export function TagChips({ tags, max = 3 }: { tags: PostCard['tags']; max?: number }) {
  if (!tags.length) return null
  return (
    <ul className="tag-list" aria-label="Tags">
      {tags.slice(0, max).map((t) => (
        <li key={t.slug}>
          <Link href={tagHref(t.slug)} className="tag">
            #{t.slug}
          </Link>
        </li>
      ))}
    </ul>
  )
}

export function PostDate({ value, short = false }: { value: string; short?: boolean }) {
  return (
    <time dateTime={new Date(value).toISOString()} className="post-date">
      {short ? formatShortDate(value) : formatDate(value)}
    </time>
  )
}

export function Cover({
  image,
  sizes,
  priority = false,
}: {
  image: CardImage
  sizes: string
  priority?: boolean
}) {
  return (
    <img
      className="cover"
      src={image.src}
      srcSet={image.srcSet}
      sizes={sizes}
      width={image.width}
      height={image.height}
      alt={image.alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
    />
  )
}

export function ReadingTime({ minutes }: { minutes: number | null }) {
  if (!minutes) return null
  return <span className="reading-time">{minutes} min</span>
}
