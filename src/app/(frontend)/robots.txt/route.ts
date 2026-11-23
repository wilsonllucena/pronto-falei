import { robotsTxt } from '@/lib/machine'
import { getSiteInfo } from '@/lib/queries'
import { textResponse } from '@/lib/textResponse'

export const dynamic = 'force-dynamic'

export async function GET() {
  return textResponse(robotsTxt(await getSiteInfo()), 'text/plain')
}
