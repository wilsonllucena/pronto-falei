import { sitemapXml } from '@/lib/machine'
import { getSiteInfo, getSitemapEntries } from '@/lib/queries'
import { textResponse } from '@/lib/textResponse'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [site, entries] = await Promise.all([getSiteInfo(), getSitemapEntries()])
  return textResponse(sitemapXml(site, entries), 'application/xml')
}
