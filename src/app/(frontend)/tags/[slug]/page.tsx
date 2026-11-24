import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { ArchiveList } from '@/components/site/ArchiveList'
import { plural } from '@/lib/dates'
import { redirectOrNotFound } from '@/lib/notFound'
import { getAllTags, getTagPage } from '@/lib/queries'
import { tagHref } from '@/lib/site'
import { pageMeta } from '@/lib/pageMeta'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const tag = await getTagPage(slug)
  if (!tag) return { title: 'Tag não encontrada' }
  return {
    title: `#${tag.slug}`,
    description:
      tag.description ||
      `Textos sobre ${tag.name} no Pronto, Falei!, do mais novo pro mais antigo.`,
    ...pageMeta(tagHref(tag.slug)),
  }
}

export default async function TagPage({ params }: Props) {
  const { slug } = await params
  const tag = await getTagPage(slug)
  if (!tag) return redirectOrNotFound(tagHref(slug))
  const others = (await getAllTags()).filter((t) => t.slug !== tag.slug)
  return (
    <div className="container container--narrow">
      <header className="page-head">
        <p className="eyebrow">
          <Link href="/tags">← Todas as tags</Link>
        </p>
        <h1 className="page-head__title">
          <span className="page-head__hash">#</span>
          {tag.slug}
        </h1>
        <p className="page-head__lead">
          {plural(tag.posts.length, 'texto', 'textos')}
          {tag.description ? ` · ${tag.description}` : ''}
        </p>
      </header>
      <section className="section" aria-label={`Textos com a tag ${tag.name}`}>
        {tag.posts.length ? (
          <ArchiveList items={tag.posts} />
        ) : (
          <p className="empty">Nenhum texto publicado com essa tag ainda.</p>
        )}
      </section>
      {others.length > 0 && (
        <nav className="section more-tags" aria-label="Outras tags">
          <h2 className="eyebrow">Outras tags</h2>
          <ul className="tag-list">
            {others.map((t) => (
              <li key={t.slug}>
                <Link href={tagHref(t.slug)} className="tag">
                  #{t.slug}
                  <span className="tag__count">{t.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  )
}
