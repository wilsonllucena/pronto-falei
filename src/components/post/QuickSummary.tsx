import React from 'react'

import { absoluteUrl, summarizeWithAiLinks } from '@/lib/post'

import { SummaryToggle } from './SummaryToggle'

type Props = {
  slug: string
  summary: string
  keyPoints: string[]
  readingTime: number | null
}

/** "Resumo rápido": TL;DR, pontos-chave, tempo de leitura e atalhos pra IA. */
export function QuickSummary({ slug, summary, keyPoints, readingTime }: Props) {
  if (!summary && !keyPoints.length) return null
  const mdPath = `/posts/${slug}.md`
  return (
    <SummaryToggle>
      <summary className="summary__head">
        <span className="summary__label">Resumo rápido</span>
        {readingTime ? (
          <span className="summary__time">texto completo: {readingTime} min</span>
        ) : null}
      </summary>
      <div className="summary__body">
        {summary && <p className="summary__tldr">{summary}</p>}
        {keyPoints.length > 0 && (
          <ul className="summary__points">
            {keyPoints.map((k, i) => (
              <li key={i}>{k}</li>
            ))}
          </ul>
        )}
        <p className="summary__links">
          <a href={mdPath} type="text/markdown">
            Ler em Markdown
          </a>
          <span aria-hidden="true">·</span>
          <span>Resumir com IA:</span>
          {summarizeWithAiLinks(absoluteUrl(mdPath)).map((l) => (
            <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer">
              {l.label}
            </a>
          ))}
        </p>
      </div>
    </SummaryToggle>
  )
}
