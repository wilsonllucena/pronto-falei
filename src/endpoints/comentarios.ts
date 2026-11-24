import type { Endpoint, PayloadRequest } from 'payload'

import {
  adminAuthHeader,
  moderationCall,
  parseModeration,
  remarkSiteId,
  remarkUpstream,
  toRecent,
} from '../lib/remark'

const NO_STORE = { 'Cache-Control': 'no-store' }

function remarkConfig() {
  const upstream = remarkUpstream()
  const site = remarkSiteId()
  const auth = adminAuthHeader()
  return upstream && site && auth ? { upstream, site, auth } : null
}

function guard(req: PayloadRequest) {
  if (!req.user)
    return Response.json({ error: 'login necessário' }, { status: 401, headers: NO_STORE })
  if (!remarkConfig())
    return Response.json({ error: 'comentários desligados' }, { status: 503, headers: NO_STORE })
  return null
}

/** GET /api/comentarios/recentes — últimos comentários e usuários bloqueados (admin logado). */
export const recentCommentsEndpoint: Endpoint = {
  path: '/comentarios/recentes',
  method: 'get',
  handler: async (req) => {
    const denied = guard(req)
    if (denied) return denied
    const { upstream, site, auth } = remarkConfig()!
    const q = `site=${encodeURIComponent(site)}`
    try {
      const [last, blocked] = await Promise.all([
        fetch(`${upstream}/api/v1/last/50?${q}`, { cache: 'no-store' }),
        fetch(`${upstream}/api/v1/admin/blocked?${q}`, {
          headers: { authorization: auth },
          cache: 'no-store',
        }),
      ])
      if (!last.ok || !blocked.ok) throw new Error(`remark42 ${last.status}/${blocked.status}`)
      const blockedRaw =
        ((await blocked.json()) as { id?: string; name?: string; time?: string }[] | null) ?? []
      return Response.json(
        {
          comments: toRecent(await last.json()),
          blocked: blockedRaw.map((u) => ({
            id: String(u.id ?? ''),
            name: String(u.name ?? ''),
            until: u.time ?? null,
          })),
        },
        { headers: NO_STORE },
      )
    } catch (err) {
      req.payload.logger.error({ err }, 'comentarios: falha ao ler o Remark42')
      return Response.json({ error: 'Remark42 indisponível' }, { status: 502, headers: NO_STORE })
    }
  },
}

/** POST /api/comentarios/moderar — {action: apagar|bloquear|desbloquear, id, url, userId}. */
export const moderateCommentEndpoint: Endpoint = {
  path: '/comentarios/moderar',
  method: 'post',
  handler: async (req) => {
    const denied = guard(req)
    if (denied) return denied
    const body = req.json ? await req.json().catch(() => null) : null
    const parsed = parseModeration(body)
    if (!parsed)
      return Response.json({ error: 'pedido inválido' }, { status: 400, headers: NO_STORE })
    const { upstream, site, auth } = remarkConfig()!
    const call = moderationCall(parsed, site)
    const res = await fetch(`${upstream}${call.path}`, {
      method: call.method,
      headers: { authorization: auth },
      cache: 'no-store',
    }).catch(() => null)
    if (!res?.ok) {
      req.payload.logger.warn(`comentarios: ${parsed.action} falhou (${res?.status ?? 'rede'})`)
      return Response.json({ error: 'Remark42 recusou' }, { status: 502, headers: NO_STORE })
    }
    req.payload.logger.info(`comentarios: ${parsed.action} por ${req.user?.email ?? '?'}`)
    return Response.json({ ok: true }, { headers: NO_STORE })
  },
}
