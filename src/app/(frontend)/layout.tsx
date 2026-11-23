import type { Metadata, Viewport } from 'next'
import React from 'react'

import { Footer } from '@/components/site/Footer'
import { Header } from '@/components/site/Header'
import { SearchShortcut } from '@/components/site/SearchShortcut'
import { fontVariables } from '@/design/fonts'
import { PALETTES, themeCss } from '@/design/tokens'
import { getSiteChrome } from '@/lib/queries'
import { themeInitScript } from '@/lib/theme'

import './styles.css'

// Header e footer vêm do banco (globals e tags populares).
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: { default: 'Pronto, Falei!', template: '%s · Pronto, Falei!' },
  description: 'Ideias, opiniões e descobertas, sem rodeios. Blog do Wilson Lima.',
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: PALETTES.light.paper },
    { media: '(prefers-color-scheme: dark)', color: PALETTES.dark.paper },
  ],
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const chrome = await getSiteChrome()
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
