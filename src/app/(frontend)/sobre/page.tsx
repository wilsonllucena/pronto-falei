import type { Metadata } from 'next'
import React from 'react'

import { AuthorCard, FindMe } from '@/components/pages/AuthorCard'
import { PostBody } from '@/components/post/PostBody'
import { getAboutData } from '@/lib/queries'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const { page, author } = await getAboutData()
  return {
    title: page?.meta?.title || 'Sobre',
    description:
      page?.meta?.description || author.bio || `Quem escreve o Pronto, Falei!: ${author.name}.`,
    alternates: { canonical: '/sobre' },
    openGraph: { type: 'profile', title: `Sobre · ${author.name}` },
  }
}

export default async function AboutPage() {
  const { page, author } = await getAboutData()
  return (
    <div className="container container--narrow about">
      <header className="page-head">
        <p className="eyebrow">Sobre</p>
        <AuthorCard author={author} />
      </header>
      <section className="section" aria-label="Sobre mim">
        {page?.content ? (
          <PostBody content={page.content} />
        ) : (
          <p className="empty">O texto do Sobre ainda não foi publicado.</p>
        )}
      </section>
      <FindMe author={author} />
    </div>
  )
}
