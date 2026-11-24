import type { Endpoint } from 'payload'

import { clientIp, createLimiter, newsletterConfig, parseSubscription } from '../lib/newsletter'

const NO_STORE = { 'Cache-Control': 'no-store' }
// anti-abuso: 5 pedidos por IP a cada 10 min; 2 e-mails de confirmação por endereço por hora
const byIp = createLimiter(5, 10 * 60_000)
const byEmail = createLimiter(2, 60 * 60_000)

const OK = {
  ok: true,
  message:
    'Quase lá! Mandamos um e-mail de confirmação. Clique no link dele pra confirmar a inscrição (confira o spam).',
}

/** POST /api/newsletter/inscrever — {email, website (isca)} → inscrição com confirmação dupla. */
export const subscribeEndpoint: Endpoint = {
  path: '/newsletter/inscrever',
  method: 'post',
  handler: async (req) => {
    const cfg = newsletterConfig()
    if (!cfg)
      return Response.json(
        { error: 'A newsletter ainda não está aberta.' },
        { status: 503, headers: NO_STORE },
      )
    const ip = clientIp(req.headers) || 'sem-ip'
    if (!byIp.allow(ip))
      return Response.json(
        { error: 'Muitas tentativas. Tente de novo daqui a pouco.' },
        { status: 429, headers: NO_STORE },
      )
    const body = req.json ? await req.json().catch(() => null) : null
    const sub = parseSubscription(body)
    if (!sub)
      return Response.json(
        { error: 'Confira o e-mail digitado.' },
        { status: 400, headers: NO_STORE },
      )
    // robô: finge que deu certo e não inscreve ninguém
    if (sub.spam) return Response.json(OK, { headers: NO_STORE })
    if (!byEmail.allow(sub.email)) return Response.json(OK, { headers: NO_STORE })
    const res = await fetch(`${cfg.upstream}/api/public/subscription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
      body: JSON.stringify({ email: sub.email, name: '', list_uuids: [cfg.listUuid] }),
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    }).catch(() => null)
    if (!res?.ok) {
      req.payload.logger.warn(`newsletter: inscrição falhou (${res?.status ?? 'rede'})`)
      return Response.json(
        { error: 'Não deu pra inscrever agora. Tente de novo mais tarde.' },
        { status: 502, headers: NO_STORE },
      )
    }
    return Response.json(OK, { headers: NO_STORE })
  },
}
