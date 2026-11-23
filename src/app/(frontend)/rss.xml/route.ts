import { FEED_LIMIT, rssXml } from '@/lib/machine'
import { getMachinePosts, getSiteInfo } from '@/lib/queries'
import { textResponse } from '@/lib/textResponse'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [site, posts] = await Promise.all([getSiteInfo(), getMachinePosts(FEED_LIMIT)])
  return textResponse(rssXml(site, posts), 'application/rss+xml')
}
