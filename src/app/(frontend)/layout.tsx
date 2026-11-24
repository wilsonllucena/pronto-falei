import type { Metadata, Viewport } from 'next'
import React from 'react'

import { Footer } from '@/components/site/Footer'
import { Header } from '@/components/site/Header'
import { SearchShortcut } from '@/components/site/SearchShortcut'
import { fontVariables } from '@/design/fonts'
import { PALETTES, themeCss } from '@/design/tokens'
import { siteUrl } from '@/lib/post'
import { getSiteChrome } from '@/lib/queries'
import { themeInitScript } from '@/lib/theme'
import { trackerConfig } from '@/lib/umami'

import './styles.css'

// Header e footer vêm do banco (globals e tags populares).
export const dynamic = 'force-dynamic'

// metadataBase em runtime: OG e canônicos relativos viram absolutos com a URL
// pública do .env (a mesma imagem Docker serve dev, Umbrel e domínio).
export function generateMetadata(): Metadata {
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: 'Pronto, Falei!', template: '%s · Pronto, Falei!' },
    description: 'Ideias, opiniões e descobertas, sem rodeios. Blog do Wilson Lima.',
  }
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: PALETTES.light.paper },
    { media: '(prefers-color-scheme: dark)', color: PALETTES.dark.paper },
  ],
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const chrome = await getSiteChrome()
  const tracker = trackerConfig()
  return (
    <html lang="pt-BR" className={fontVariables} suppressHydrationWarning>
      <head>
        {/* Tema salvo aplicado antes da primeira pintura (sem piscar). */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <style dangerouslySetInnerHTML={{ __html: themeCss() }} />
        {/* Feeds e índice pra IA (passo 7) */}
        <link rel="alternate" type="application/rss+xml" title={chrome.siteName} href="/rss.xml" />
        <link
          rel="alternate"
          type="application/atom+xml"
          title={chrome.siteName}
          href="/atom.xml"
        />
        <link
          rel="alternate"
          type="application/feed+json"
          title={chrome.siteName}
          href="/feed.json"
        />
        <link rel="alternate" type="text/plain" title="llms.txt" href="/llms.txt" />
        {/* Analytics self-hosted (passo 11): sem cookies, respeita Do Not Track */}
        {tracker && (
          <script
            defer
            src="/stats/script.js"
            data-website-id={tracker.websiteId}
            data-domains={tracker.domains || undefined}
            data-do-not-track={tracker.doNotTrack ? 'true' : undefined}
          />
        )}
      </head>
      <body>
        <a href="#conteudo" className="skip-link">
          Pular para o conteúdo
        </a>
        <Header nav={chrome.header} />
        <SearchShortcut />
        <main id="conteudo" tabIndex={-1}>
          {children}
        </main>
        <Footer
          links={chrome.footer}
          popularTags={chrome.popularTags}
          social={chrome.social}
          tagline={chrome.tagline}
        />
      </body>
    </html>
  )
}
