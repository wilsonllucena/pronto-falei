import { injectDateShim, remarkUpstream } from '@/lib/remark'

export const dynamic = 'force-dynamic'

/**
 * /comentarios/web/iframe.html — o único arquivo do Remark42 que não é
 * repassado direto pelo proxy: o app busca o HTML e injeta o ajuste que faz as
 * datas saírem em pt-BR (24/11/2026 às 01:00).
 */
export async function GET(req: Request) {
  const upstream = remarkUpstream()
  if (!upstream) return new Response('Not found', { status: 404 })
  const { search } = new URL(req.url)
  const res = await fetch(`${upstream}/web/iframe.html${search}`, { cache: 'no-store' }).catch(
    () => null,
  )
  if (!res?.ok) return new Response('Comentários indisponíveis', { status: 502 })
  return new Response(injectDateShim(await res.text()), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  })
}
