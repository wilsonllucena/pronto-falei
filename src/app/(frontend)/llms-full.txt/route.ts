import { llmsFullTxt } from '@/lib/machine'
import { getMachinePosts, getSiteInfo } from '@/lib/queries'
import { textResponse } from '@/lib/textResponse'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [site, posts] = await Promise.all([getSiteInfo(), getMachinePosts(null)])
  return textResponse(llmsFullTxt(site, posts), 'text/plain')
}
