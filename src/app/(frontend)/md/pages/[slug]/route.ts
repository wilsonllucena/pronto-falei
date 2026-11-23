import { pageMarkdown } from '@/lib/machine'
import { getMachinePages, getSiteInfo } from '@/lib/queries'
import { notFoundText, textResponse } from '@/lib/textResponse'

export const dynamic = 'force-dynamic'

/** /sobre.md e outras páginas publicadas em Markdown. */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [pages, site] = await Promise.all([getMachinePages(), getSiteInfo()])
  const page = pages.find((p) => p.slug === slug)
  if (!page) return notFoundText()
  return textResponse(pageMarkdown(page, site), 'text/markdown', {
    Link: `<${site.url}/${page.slug}>; rel="canonical"`,
  })
}
