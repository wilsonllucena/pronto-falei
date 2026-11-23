'use client'

import { useEffect } from 'react'

/** Marca no índice a seção que está na tela (só visual; sem JS o índice funciona). */
export function TocSpy({ ids }: { ids: string[] }) {
  useEffect(() => {
    const headings = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el))
    if (!headings.length || !('IntersectionObserver' in window)) return
    const setActive = (id: string) => {
      document.querySelectorAll('.toc--side [data-toc-link]').forEach((a) => {
        if (a.getAttribute('data-toc-link') === id) a.setAttribute('aria-current', 'true')
        else a.removeAttribute('aria-current')
      })
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting)
        if (visible[0]) setActive(visible[0].target.id)
      },
      { rootMargin: '-80px 0px -70% 0px' },
    )
    headings.forEach((h) => observer.observe(h))
    return () => observer.disconnect()
  }, [ids])
  return null
}
