import Link from 'next/link'
import React from 'react'

import type { NavLink } from '@/lib/site'

import { NavLinkItem } from './NavLinkItem'
import { ThemeToggle } from './ThemeToggle'
import { Wordmark } from './Wordmark'

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </svg>
)

/** Header fixo e compacto: wordmark, menu, busca e tema. No mobile o menu vira "Menu". */
export function Header({ nav }: { nav: NavLink[] }) {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Wordmark />
        <nav className="site-nav" aria-label="Principal">
          <ul className="site-nav__list">
            {nav.map((item) => (
              <li key={item.url + item.label}>
                <NavLinkItem item={item} className="site-nav__link" />
              </li>
            ))}
          </ul>
        </nav>
        <div className="site-header__tools">
          <Link href="/busca" className="icon-btn" aria-label="Buscar" title="Buscar">
            <SearchIcon />
          </Link>
          <ThemeToggle />
          <details className="mobile-menu">
            <summary className="icon-btn" aria-label="Abrir menu">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </summary>
            <nav className="mobile-menu__panel" aria-label="Menu">
              <ul>
                {nav.map((item) => (
                  <li key={item.url + item.label}>
                    <NavLinkItem item={item} className="mobile-menu__link" />
                  </li>
                ))}
              </ul>
            </nav>
          </details>
        </div>
      </div>
    </header>
  )
}
