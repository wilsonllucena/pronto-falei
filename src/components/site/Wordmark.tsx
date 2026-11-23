import Link from 'next/link'
import React from 'react'

type Props = { as?: 'link' | 'h1' | 'span'; size?: 'sm' | 'lg' }

/** Wordmark só em texto: "Pronto," em tinta e "Falei!" em laranja com grifo amarelo. */
export function Wordmark({ as = 'link', size = 'sm' }: Props) {
  const inner = (
    <>
      Pronto, <span className="wordmark__falei">Falei!</span>
    </>
  )
  const cls = `wordmark wordmark--${size}`
  if (as === 'h1') return <h1 className={cls}>{inner}</h1>
  if (as === 'span') return <span className={cls}>{inner}</span>
  return (
    <Link href="/" className={cls} aria-label="Pronto, Falei! — página inicial">
      {inner}
    </Link>
  )
}
