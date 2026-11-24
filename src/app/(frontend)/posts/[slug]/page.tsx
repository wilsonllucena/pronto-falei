import config from '@payload-config'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'

import { LivePreview } from '@/components/post/LivePreview'
import { PostBody } from '@/components/post/PostBody'
import { PostHeader } from '@/components/post/PostHeader'
import { QuickSummary } from '@/components/post/QuickSummary'
import { Related } from '@/components/post/Related'
import { SeriesNav } from '@/components/post/SeriesNav'
import { TocMobile, TocSide } from '@/components/post/Toc'
import { Comments } from '@/components/site/Comments'
import { blogPostingJsonLd, jsonLdString, postMdPath } from '@/lib/machine'
import { redirectOrNotFound } from '@/lib/notFound'
import { absoluteUrl, withHeadingAnchors } from '@/lib/post'
import {
  getDraftPost,
  getPublishedPost,
  getPostSeries,
  getRelatedPosts,
  getSiteInfo,
  toMachinePost,
} from '@/lib/queries'
import { remarkSiteId } from '@/lib/remark'
import { seoDescription } from '@/lib/seo'
import { toPostCard } from '@/lib/site'
import type { Media, Post } from '@/payload-types'

// Renderiza por request, mas os dados vêm do cache com tags: publicar ou
// editar no admin invalida só o que mudou (ISR sob demanda).
export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/** Pré-visualização só pra quem está logado no admin (cookie do Payload). */
async function isPreview(searchParams: Props['searchParams']): Promise<boolean> {
  if ((await searchParams).preview !== '1') return false
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  return Boolean(user)
}

async function loadPost(slug: string, preview: boolean): Promise<Post | null> {
  return preview ? getDraftPost(slug) : getPublishedPost(slug)
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params
  const preview = await isPreview(searchParams)
  const post = await loadPost(slug, preview)
  if (!post) return { title: 'Post não encontrado' }
  const url = absoluteUrl(`/posts/${post.slug}`)
  const meta = post.meta ?? {}
  const metaImage = typeof meta.image === 'object' ? (meta.image as Media | null) : null
  const ogFromMeta = metaImage?.sizes?.og?.url
  const tags = (post.tags ?? []).flatMap((t) => (typeof t === 'object' ? [t.name] : []))
  return {
    title: meta.title || post.title,
    description: meta.description || seoDescription(post),
    alternates: {
      canonical: url,
      // versão pra máquinas (passo 7)
      types: { 'text/markdown': absoluteUrl(postMdPath(post.slug)) },
    },
    robots: preview ? { index: false, follow: false } : undefined,
    openGraph: {
      type: 'article',
      url,
      title: meta.title || post.title,
      description: meta.description || seoDescription(post),
      siteName: 'Pronto, Falei!',
      locale: 'pt_BR',
      publishedTime: post.publishedAt ?? undefined,
      modifiedTime: post.updatedAt,
      tags,
      ...(ogFromMeta
        ? { images: [{ url: ogFromMeta, width: 1200, height: 630, alt: metaImage?.alt }] }
        : {}),
    },
    twitter: { card: 'summary_large_image' },
  }
}

export default async function PostPage({ params, searchParams }: Props) {
  const { slug } = await params
  const preview = await isPreview(searchParams)
  const post = await loadPost(slug, preview)
  if (!post) return redirectOrNotFound(`/posts/${slug}`)

  const card = toPostCard(post)
  const coverMedia = typeof post.cover === 'object' ? (post.cover as Media | null) : null
  const { content, toc } = withHeadingAnchors(post.content)
  const [related, series, site] = await Promise.all([
    preview ? Promise.resolve([]) : getRelatedPosts(post.slug),
    preview ? Promise.resolve(null) : getPostSeries(post.slug),
    getSiteInfo(),
  ])
  const commentsSite = remarkSiteId()
  const jsonLd = preview ? null : jsonLdString(blogPostingJsonLd(toMachinePost(post), site))

  return (
    <article className="post" data-preview={preview || undefined}>
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />}
      {preview && (
        <div className="preview-bar" role="status">
          <span>Pré-visualização do rascunho. Só você está vendo.</span>
          <Link href={`/posts/${post.slug}`}>Ver a versão publicada</Link>
          <LivePreview />
        </div>
      )}
      <div className="container">
        <PostHeader card={card} coverMedia={coverMedia} />
      </div>
      <div className="container post-layout">
        <div className="post-main">
          <QuickSummary
            slug={post.slug}
            summary={post.summary ?? ''}
            keyPoints={(post.keyPoints ?? []).map((k) => k.text)}
            readingTime={post.readingTime ?? null}
          />
          <TocMobile items={toc} />
          <PostBody content={content} />
        </div>
        {toc.length >= 2 && (
          <aside className="post-aside">
            <TocSide items={toc} />
          </aside>
        )}
      </div>
      <div className="container">
        <SeriesNav series={series} />
        {commentsSite && !preview && (
          <Comments
            siteId={commentsSite}
            url={absoluteUrl(`/posts/${post.slug}`)}
            title={post.title}
          />
        )}
        <Related posts={related} />
      </div>
    </article>
  )
}
