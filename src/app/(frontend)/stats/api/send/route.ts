import { forwardHeaders, MAX_EVENT_BYTES, umamiUpstream } from '@/lib/umami'

export const dynamic = 'force-dynamic'

/** Coleta de eventos: repassa pro Umami na rede interna. */
export async function POST(request: Request) {
  const upstream = umamiUpstream()
  if (!upstream) return new Response('Not found', { status: 404 })
  const body = await request.text()
  if (new TextEncoder().encode(body).byteLength > MAX_EVENT_BYTES) {
    return new Response('Payload too large', { status: 413 })
  }
  try {
    const res = await fetch(`${upstream}/api/send`, {
      method: 'POST',
      headers: forwardHeaders(request.headers),
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
    return new Response(await res.text(), {
      status: res.status,
      headers: {
        'content-type': res.headers.get('content-type') ?? 'application/json',
        'cache-control': 'no-store',
      },
    })
  } catch {
    return new Response('', { status: 502 })
  }
}
