'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

const isTyping = (el: EventTarget | null) => {
  if (!(el instanceof HTMLElement)) return false
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)
}

/** Atalho "/": foca a busca da página ou abre /busca. */
export function SearchShortcut() {
  const router = useRouter()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return
      e.preventDefault()
      const input = document.getElementById('busca-q') as HTMLInputElement | null
      if (input) {
        input.focus()
        input.select()
      } else {
        router.push('/busca')
      }
    }
    window.addEventListener('keydown', onKey)
    document.documentElement.dataset.searchShortcut = 'ready'
    return () => window.removeEventListener('keydown', onKey)
  }, [router])
  return null
}
