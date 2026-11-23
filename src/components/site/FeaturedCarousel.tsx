'use client'

import React, { useEffect, useRef, useState } from 'react'

/**
 * Trilho dos destaques: grade de 3 no desktop; no mobile vira carrossel com
 * scroll-snap e botões ‹ ›. Sem JS o trilho continua rolando no dedo.
 */
export function FeaturedCarousel({
  count,
  children,
}: {
  count: number
  children: React.ReactNode
}) {
  const track = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = track.current
    if (!el) return
    const onScroll = () => {
      const w = el.firstElementChild?.getBoundingClientRect().width ?? el.clientWidth
      setIndex(Math.min(count - 1, Math.round(el.scrollLeft / Math.max(1, w))))
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    root.current?.setAttribute('data-ready', '')
    return () => el.removeEventListener('scroll', onScroll)
  }, [count])

  const go = (delta: number) => {
    const el = track.current
    if (!el) return
    const next = Math.max(0, Math.min(count - 1, index + delta))
    const item = el.children[next] as HTMLElement | undefined
    if (item) el.scrollTo({ left: item.offsetLeft - el.offsetLeft, behavior: 'smooth' })
    setIndex(next)
  }

  return (
    <div className="featured" ref={root}>
      {count > 1 && (
        <div className="featured__controls" aria-label="Navegar nos destaques">
          <button
            type="button"
            className="icon-btn"
            onClick={() => go(-1)}
            disabled={index === 0}
            aria-label="Destaque anterior"
          >
            ‹
          </button>
          <span className="featured__count" aria-live="polite">
            {index + 1}/{count}
          </span>
          <button
            type="button"
            className="icon-btn"
            onClick={() => go(1)}
            disabled={index >= count - 1}
            aria-label="Próximo destaque"
          >
            ›
          </button>
        </div>
      )}
      <div className="featured__track" ref={track}>
        {children}
      </div>
    </div>
  )
}
