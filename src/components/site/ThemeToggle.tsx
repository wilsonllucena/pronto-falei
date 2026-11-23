'use client'

import React, { useEffect, useRef } from 'react'

import { themeCookie } from '@/lib/theme'

function currentTheme(): 'light' | 'dark' {
  const attr = document.documentElement.getAttribute('data-theme')
  if (attr === 'light' || attr === 'dark') return attr
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** Alterna claro/escuro e salva no cookie. Os ícones trocam só por CSS (sem piscar). */
export function ThemeToggle() {
  const btn = useRef<HTMLButtonElement>(null)
  useEffect(() => btn.current?.setAttribute('data-ready', ''), [])
  const onClick = () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    document.cookie = themeCookie(next)
  }
  return (
    <button
      type="button"
      className="icon-btn theme-toggle"
      onClick={onClick}
      ref={btn}
      aria-label="Alternar tema claro/escuro"
      title="Alternar tema claro/escuro"
    >
      <svg className="theme-toggle__moon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
      </svg>
      <svg className="theme-toggle__sun" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="4.2" />
        <path d="M12 2v2.5M12 19.5V22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2 12h2.5M19.5 12H22M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
      </svg>
    </button>
  )
}
