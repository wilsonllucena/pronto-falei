/* eslint-disable @next/next/no-img-element -- imagens em WebP nos tamanhos do Payload */
import React from 'react'

import { cardImage } from '@/lib/site'
import { parseEmbed } from '@/lib/post'
import type { Media } from '@/payload-types'

const CALLOUT_LABEL: Record<string, string> = {
  info: 'Info',
  dica: 'Dica',
  atencao: 'Atenção',
  perigo: 'Perigo',
}

export function Callout({
  tone,
  title,
  content,
}: {
  tone?: string | null
  title?: string | null
  content: string
}) {
  const t = tone && tone in CALLOUT_LABEL ? tone : 'info'
  return (
    <aside className={`callout callout--${t}`} role="note" aria-label={title || CALLOUT_LABEL[t]}>
      <p className="callout__title">{title || CALLOUT_LABEL[t]}</p>
      {content.split(/\n{2,}/).map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </aside>
  )
}

export function Quote({
  text,
  author,
  sourceUrl,
}: {
  text: string
  author?: string | null
  sourceUrl?: string | null
}) {
  const safeSource = sourceUrl && /^https?:\/\//i.test(sourceUrl) ? sourceUrl : null
  return (
    <figure className="quote">
      <blockquote cite={safeSource ?? undefined}>
        {text.split(/\n{2,}/).map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </blockquote>
      {(author || safeSource) && (
        <figcaption>
          —{' '}
          {safeSource ? (
            <a href={safeSource} rel="noopener noreferrer" target="_blank">
              {author || 'fonte'}
            </a>
          ) : (
            author
          )}
        </figcaption>
      )}
    </figure>
  )
}

export function EmbedBlock({ url, caption }: { url: string; caption?: string | null }) {
  const embed = parseEmbed(url)
  if (embed.kind === 'youtube') {
    return (
      <figure className="embed embed--video">
        <div className="embed__frame">
          <iframe
            src={embed.src}
            title={caption || 'Vídeo do YouTube'}
            loading="lazy"
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
        {caption && <figcaption>{caption}</figcaption>}
      </figure>
    )
  }
  const label =
    embed.kind === 'x'
      ? embed.isPost
        ? `Ver post${embed.handle ? ` de @${embed.handle}` : ''} no X`
        : `Ver @${embed.handle ?? 'perfil'} no X`
      : 'Abrir link'
  return (
    <figure className="embed embed--card">
      <a href={embed.url} target="_blank" rel="noopener noreferrer" className="embed__card">
        <span className="embed__kind">{embed.kind === 'x' ? 'X' : 'Link'}</span>
        <span className="embed__label">{label} ↗</span>
        <span className="embed__url">{embed.url.replace(/^https?:\/\//, '')}</span>
      </a>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  )
}

export function Figure({
  media,
  caption,
}: {
  media: Media | string | null | undefined
  caption?: string | null
}) {
  if (!media || typeof media !== 'object') return null
  const img = cardImage(media, 'card')
  if (!img) return null
  const text = caption || media.caption
  return (
    <figure className="figure">
      <img
        src={img.src}
        srcSet={img.srcSet}
        sizes="(min-width: 760px) 720px, 100vw"
        width={img.width}
        height={img.height}
        alt={img.alt}
        loading="lazy"
        decoding="async"
      />
      {(text || media.credit) && (
        <figcaption>
          {text}
          {media.credit && <span className="figure__credit"> Crédito: {media.credit}</span>}
        </figcaption>
      )}
    </figure>
  )
}
