'use client'

import React, { useRef, useState } from 'react'

/** Copia o código do bloco. Sem JS o código continua selecionável. */
export function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(code)
    } catch {
      const area = document.createElement('textarea')
      area.value = code
      document.body.appendChild(area)
      area.select()
      document.execCommand('copy')
      area.remove()
    }
    setCopied(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button type="button" className="code__copy" onClick={onClick} aria-live="polite">
      {copied ? 'Copiado!' : 'Copiar'}
    </button>
  )
}
