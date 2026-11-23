import { FEED_LIMIT, jsonFeed } from '@/lib/machine'
import { getMachinePosts, getSiteInfo } from '@/lib/queries'
import { textResponse } from '@/lib/textResponse'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [site, posts] = await Promise.all([getSiteInfo(), getMachinePosts(FEED_LIMIT)])
  return textResponse(JSON.stringify(jsonFeed(site, posts), null, 2), 'application/feed+json')
}
