'use client'

import React, { useEffect, useRef } from 'react'

const KEY = 'pf-resumo'

/** <details> do "Resumo rápido" que lembra se a pessoa fechou (aberto por padrão). */
export function SummaryToggle({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    try {
      if (window.localStorage.getItem(KEY) === 'fechado') el.open = false
    } catch {
      /* sem storage: fica aberto */
    }
    const onToggle = () => {
      try {
        window.localStorage.setItem(KEY, el.open ? 'aberto' : 'fechado')
      } catch {
        /* ok */
      }
    }
    el.addEventListener('toggle', onToggle)
    el.setAttribute('data-ready', '')
    return () => el.removeEventListener('toggle', onToggle)
  }, [])
  return (
    <details className="summary" open ref={ref}>
      {children}
    </details>
  )
}
