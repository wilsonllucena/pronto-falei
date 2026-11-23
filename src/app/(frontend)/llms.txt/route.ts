import { llmsTxt } from '@/lib/machine'
import { getMachinePages, getMachinePosts, getSiteInfo } from '@/lib/queries'
import { textResponse } from '@/lib/textResponse'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [site, posts, pages] = await Promise.all([
    getSiteInfo(),
    getMachinePosts(null),
    getMachinePages(),
  ])
  return textResponse(llmsTxt(site, posts, pages), 'text/plain')
}
