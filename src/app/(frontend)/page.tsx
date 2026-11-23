import Link from 'next/link'
import React from 'react'

import { FeaturedCards } from '@/components/site/FeaturedCards'
import { PostList } from '@/components/site/PostList'
import { ViewToggle } from '@/components/site/ViewToggle'
import { getHomeData, getSiteChrome } from '@/lib/queries'

// Lê o banco a cada request por enquanto; ISR com revalidação sob demanda
// entra junto com as rotas de post e feeds.
export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const [{ featured, recent, total }, chrome] = await Promise.all([getHomeData(), getSiteChrome()])
  return (
    <div className="container">
      <section className="hero" aria-labelledby="hero-title">
        <h1 id="hero-title" className="hero__title">
          {chrome.tagline}
        </h1>
        <p className="hero__lead">
          Blog do Wilson Lima sobre desenvolvimento, IA, homelab e carreira.{' '}
          <mark className="hl">Pronto, falei.</mark>
        </p>
        <div className="hero__actions">
          <a href="/feed.xml" className="btn btn--ghost">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 5a14 14 0 0 1 14 14M5 11a8 8 0 0 1 8 8" />
              <circle cx="6" cy="18" r="1.6" />
            </svg>
            RSS
          </a>
          <Link href="/blog" className="btn">
            Todos os textos
          </Link>
        </div>
      </section>

      <FeaturedCards posts={featured} />

      <section className="section" aria-labelledby="recentes">
        <div className="section__head">
          <h2 id="recentes" className="section__title">
            Recentes
          </h2>
          {recent.length > 0 && <ViewToggle target="lista-recentes" />}
        </div>
        {recent.length ? (
          <PostList posts={recent} id="lista-recentes" />
        ) : (
          <p className="empty">Ainda não tem texto publicado. Já já sai o primeiro.</p>
        )}
        {total > recent.length && (
          <p className="more">
            <Link href="/blog" className="more__link">
              Ver todos os {total} textos →
            </Link>
          </p>
        )}
      </section>
    </div>
  )
}
