import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { ImageResponse } from 'next/og'

import { PALETTES } from '@/design/tokens'
import { formatDate } from '@/lib/dates'
import { getPublishedPost } from '@/lib/queries'

export const alt = 'Pronto, Falei!'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const dynamic = 'force-dynamic'

const fontsDir = path.join(process.cwd(), 'src/assets/og')
const font = (file: string) => readFile(path.join(fontsDir, file))

/** OG image automática: título, linha fina, data e o wordmark. */
export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = await getPublishedPost(slug)
  const [display, regular, semibold] = await Promise.all([
    font('bricolage-grotesque-latin-800-normal.woff'),
    font('inter-latin-400-normal.woff'),
    font('inter-latin-600-normal.woff'),
  ])
  const c = PALETTES.light
  const title = post?.title ?? 'Pronto, Falei!'
  const subtitle = post?.subtitle ?? post?.summary ?? 'Ideias, opiniões e descobertas, sem rodeios.'
  const titleSize = title.length > 70 ? 58 : title.length > 40 ? 68 : 80

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: c.paper,
        padding: '64px 72px',
        fontFamily: 'Inter',
        borderTop: `16px solid ${c.accent}`,
      }}
    >
      <div style={{ display: 'flex', fontSize: 26, color: c.muted, fontWeight: 600 }}>
        {post?.publishedAt ? formatDate(post.publishedAt) : ''}
        {post?.readingTime ? ` · ${post.readingTime} min de leitura` : ''}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div
          style={{
            display: 'flex',
            fontFamily: 'Bricolage',
            fontSize: titleSize,
            lineHeight: 1.05,
            letterSpacing: '-0.02em',
            color: c.ink,
          }}
        >
          {title}
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 30,
            lineHeight: 1.35,
            color: c.muted,
            maxHeight: 82,
            overflow: 'hidden',
          }}
        >
          {subtitle.length > 140 ? `${subtitle.slice(0, 137)}…` : subtitle}
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          fontFamily: 'Bricolage',
          fontSize: 44,
          color: c.ink,
        }}
      >
        Pronto,&nbsp;
        <span
          style={{
            color: c.accent,
            padding: '0 6px',
            backgroundImage: `linear-gradient(transparent 55%, ${c.highlight} 55%)`,
          }}
        >
          Falei!
        </span>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: 'Bricolage', data: display, weight: 800, style: 'normal' },
        { name: 'Inter', data: regular, weight: 400, style: 'normal' },
        { name: 'Inter', data: semibold, weight: 600, style: 'normal' },
      ],
    },
  )
}
