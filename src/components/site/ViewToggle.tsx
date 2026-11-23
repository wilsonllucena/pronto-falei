'use client'

import React, { useEffect, useRef, useSyncExternalStore } from 'react'

export type ListView = 'lista' | 'grade'
const KEY = 'pf-view'
const EVENT = 'pf-view-change'

function readView(): ListView {
  try {
    return window.localStorage.getItem(KEY) === 'grade' ? 'grade' : 'lista'
  } catch {
    return 'lista'
  }
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener(EVENT, cb)
    window.removeEventListener('storage', cb)
  }
}

/**
 * Alterna a lista de posts entre "Lista" e "Grade" (o mesmo HTML, só muda o CSS)
 * e lembra a escolha no navegador.
 */
export function ViewToggle({ target }: { target: string }) {
  const view = useSyncExternalStore(subscribe, readView, () => 'lista' as ListView)
  const group = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.getElementById(target)?.setAttribute('data-view', view)
    group.current?.setAttribute('data-ready', '')
  }, [target, view])

  const choose = (next: ListView) => {
    try {
      window.localStorage.setItem(KEY, next)
    } catch {
      /* modo privado: só não lembra */
    }
    document.getElementById(target)?.setAttribute('data-view', next)
    window.dispatchEvent(new Event(EVENT))
  }

  return (
    <div className="view-toggle" role="group" aria-label="Modo de exibição" ref={group}>
      {(['lista', 'grade'] as const).map((v) => (
        <button
          key={v}
          type="button"
          className="view-toggle__btn"
          aria-pressed={view === v}
          onClick={() => choose(v)}
        >
          {v === 'lista' ? 'Lista' : 'Grade'}
        </button>
      ))}
    </div>
  )
}
