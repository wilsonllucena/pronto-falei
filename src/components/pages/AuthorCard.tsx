/* eslint-disable @next/next/no-img-element -- a foto já sai em WebP no tamanho do Payload */
import React from 'react'

import type { AuthorInfo } from '@/lib/queries'

const NETWORK_LABEL: Record<string, string> = {
  x: 'X',
  github: 'GitHub',
  linkedin: 'LinkedIn',
  instagram: 'Instagram',
  youtube: 'YouTube',
  bluesky: 'Bluesky',
  email: 'E-mail',
  outro: 'Link',
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

export function AuthorCard({ author }: { author: AuthorInfo }) {
  return (
    <div className="author">
      {author.photo ? (
        <img
          className="author__photo"
          src={author.photo.src}
          width={author.photo.width}
          height={author.photo.height}
          alt={author.photo.alt}
          decoding="async"
        />
      ) : (
        <span className="author__photo author__photo--initials" aria-hidden="true">
          {initials(author.name)}
        </span>
      )}
      <div className="author__text">
        <h1 className="author__name">{author.name}</h1>
        <p className="author__role">{author.role}</p>
        {author.bio && <p className="author__bio">{author.bio}</p>}
      </div>
    </div>
  )
}

export function FindMe({ author }: { author: AuthorInfo }) {
  const links = [
    ...author.social.map((s) => ({
      label: NETWORK_LABEL[s.network] ?? s.network,
      href: s.url,
      external: true,
    })),
    ...(author.email ? [{ label: 'E-mail', href: `mailto:${author.email}`, external: false }] : []),
    { label: 'RSS', href: '/rss.xml', external: false },
  ]
  return (
    <section className="find-me" aria-labelledby="onde-me-achar">
      <h2 id="onde-me-achar" className="eyebrow">
        Onde me achar
      </h2>
      <ul className="find-me__list">
        {links.map((l) => (
          <li key={l.href}>
            <a
              href={l.href}
              className="find-me__link"
              {...(l.external ? { target: '_blank', rel: 'me noopener noreferrer' } : {})}
            >
              {l.label}
            </a>
          </li>
        ))}
      </ul>
      <p className="find-me__sign">Pronto, falei!</p>
    </section>
  )
}
