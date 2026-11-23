import type { Metadata } from 'next'
import React from 'react'

import { PostBody } from '@/components/post/PostBody'
import { redirectOrNotFound } from '@/lib/notFound'
import { getPublishedPage } from '@/lib/queries'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ path: string[] }> }

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Páginas editáveis (/uses, /contato...) e, se não houver, redirecionamento ou 404. */
async function pageFor(path: string[]) {
  if (path.length !== 1 || !SLUG.test(path[0])) return null
  return getPublishedPage(path[0])
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await pageFor((await params).path)
  if (!page) return { title: 'Página não encontrada' }
  return {
    title: page.meta?.title || page.title,
    description: page.meta?.description || undefined,
    alternates: { canonical: `/${page.slug}` },
  }
}

export default async function CatchAllPage({ params }: Props) {
  const { path } = await params
  const page = await pageFor(path)
  if (!page) return redirectOrNotFound(`/${path.map(encodeURIComponent).join('/')}`)
  return (
    <div className="container container--narrow">
      <header className="page-head">
        <h1 className="page-head__title">{page.title}</h1>
      </header>
      <section className="section">
        <PostBody content={page.content} />
      </section>
    </div>
  )
}
