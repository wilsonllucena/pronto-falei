import React from 'react'

import { highlight } from '@/lib/highlight'
import { LANGUAGE_LABEL } from '@/lib/post'

import { CopyButton } from './CopyButton'

type Props = { code: string; language?: string | null; title?: string | null }

/** Bloco de código: título/linguagem, realce do Shiki e botão Copiar. */
export async function CodeBlock({ code, language, title }: Props) {
  const html = await highlight(code, language)
  const label = LANGUAGE_LABEL[language ?? 'text'] ?? language ?? 'texto'
  return (
    <figure className="code" data-language={language ?? 'text'}>
      <figcaption className="code__bar">
        <span className="code__title">{title || label}</span>
        {title && <span className="code__lang">{label}</span>}
        <CopyButton code={code} />
      </figcaption>
      <div className="code__body" dangerouslySetInnerHTML={{ __html: html }} />
    </figure>
  )
}
