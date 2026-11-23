import { postMarkdown, postPath } from '@/lib/machine'
import { getMachinePost, getSiteInfo } from '@/lib/queries'
import { notFoundText, textResponse } from '@/lib/textResponse'

export const dynamic = 'force-dynamic'

/** /posts/slug.md (rewrite no next.config): o post em Markdown com frontmatter. */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [post, site] = await Promise.all([getMachinePost(slug), getSiteInfo()])
  if (!post) return notFoundText()
  return textResponse(postMarkdown(post, site), 'text/markdown', {
    Link: `<${site.url}${postPath(post.slug)}>; rel="canonical"`,
  })
}
