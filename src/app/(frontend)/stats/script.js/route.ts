import { umamiUpstream } from '@/lib/umami'

export const dynamic = 'force-dynamic'

/** Script do Umami servido pelo próprio domínio (sem terceiros no navegador). */
export async function GET() {
  const upstream = umamiUpstream()
  if (!upstream) return new Response('Not found', { status: 404 })
  try {
    const res = await fetch(`${upstream}/script.js`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return new Response('', { status: 502 })
    return new Response(await res.text(), {
      headers: {
        'content-type': 'application/javascript; charset=utf-8',
        'cache-control': 'public, max-age=3600',
      },
    })
  } catch {
    return new Response('', { status: 502 })
  }
}
