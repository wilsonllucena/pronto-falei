import Link from 'next/link'
import React from 'react'

import type { NavLink, TagCount } from '@/lib/site'
import { tagHref } from '@/lib/site'

import { NavLinkItem } from './NavLinkItem'
import { Wordmark } from './Wordmark'

type Props = {
  links: NavLink[]
  popularTags: TagCount[]
  social: { network: string; url: string }[]
  tagline: string
}

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

export function Footer({ links, popularTags, social, tagline }: Props) {
  const year = new Date().getFullYear()
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__brand">
          <Wordmark as="span" />
          <p className="site-footer__tagline">{tagline}</p>
        </div>
        {popularTags.length > 0 && (
          <nav className="site-footer__tags" aria-label="Tags populares">
            <h2 className="eyebrow">Tags populares</h2>
            <ul className="tag-list">
              {popularTags.map((t) => (
                <li key={t.slug}>
                  <Link href={tagHref(t.slug)} className="tag">
                    #{t.slug}
                    <span className="tag__count" aria-label={`${t.count} textos`}>
                      {t.count}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
        <nav className="site-footer__links" aria-label="Rodapé">
          <ul>
            {links.map((l) => (
              <li key={l.url + l.label}>
                <NavLinkItem item={l} />
              </li>
            ))}
            {social.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="me noopener noreferrer">
                  {NETWORK_LABEL[s.network] ?? s.network}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <p className="site-footer__copy">
          © {year} Wilson Lima. <span className="site-footer__sign">Pronto, falei!</span>
        </p>
      </div>
    </footer>
  )
}
