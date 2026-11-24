/**
 * Comentários self-hosted (Remark42, passo 12), servidos pelo próprio domínio:
 * /comentarios/* é repassado pro container do Remark42 na rede interna (sem
 * porta no host). Comentário anônimo, sem OAuth; moderação pelo admin do blog.
 *
 * Env: REMARK_INTERNAL_URL (ex.: http://remark42:8080), REMARK_SITE_ID,
 * REMARK_ADMIN_PASSWD (só no servidor: API de admin do Remark42).
 */
type Env = Record<string, string | undefined>

export const COMMENTS_PREFIX = '/comentarios'

/** Cookies que o Remark42 usa; os do blog (login do admin, tema) não vão pra ele. */
export const REMARK_COOKIES = ['JWT', 'XSRF-TOKEN']

export function remarkUpstream(env: Env = process.env): string | null {
  const raw = env['REMARK_INTERNAL_URL']?.trim()
  if (!raw) return null
  try {
    const u = new URL(raw)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return `${u.origin}${u.pathname.replace(/\/+$/, '')}`
  } catch {
    return null
  }
}

export function remarkSiteId(env: Env = process.env): string | null {
  const site = env['REMARK_SITE_ID']?.trim() ?? ''
  return /^[a-z0-9_-]{1,64}$/i.test(site) && remarkUpstream(env) ? site : null
}

/** /comentarios/api/v1/find?x → <upstream>/api/v1/find?x (null fora do prefixo). */
export function remarkTarget(pathname: string, search: string, env: Env = process.env) {
  const upstream = remarkUpstream(env)
  if (!upstream) return null
  if (pathname !== COMMENTS_PREFIX && !pathname.startsWith(`${COMMENTS_PREFIX}/`)) return null
  const rest = pathname.slice(COMMENTS_PREFIX.length) || '/'
  if (rest.split('/').some((seg) => seg === '..')) return null
  return `${upstream}${rest}${search}`
}

/** Só os cookies do Remark42. */
export function filterCookies(header: string | null): string {
  if (!header) return ''
  return header
    .split(';')
    .map((c) => c.trim())
    .filter((c) => {
      const eq = c.indexOf('=')
      return eq > 0 && REMARK_COOKIES.includes(c.slice(0, eq))
    })
    .join('; ')
}

/**
 * Cabeçalhos pro Remark42: tira os cookies do blog e passa o IP real do
 * visitante (Cloudflare) pro rate limit e pra identidade anônima.
 */
export function remarkRequestHeaders(from: Headers): Headers {
  const out = new Headers(from)
  const cookies = filterCookies(from.get('cookie'))
  if (cookies) out.set('cookie', cookies)
  else out.delete('cookie')
  out.delete('authorization')
  const ip =
    from.get('cf-connecting-ip')?.trim() ||
    from.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    from.get('x-real-ip')?.trim()
  if (ip) {
    out.set('x-real-ip', ip)
    out.set('x-forwarded-for', ip)
  }
  return out
}

/* ---------- moderação (só no servidor; usa a senha de admin do Remark42) ---------- */

export type ModerationAction = 'apagar' | 'bloquear' | 'desbloquear'

export type ModerationRequest = {
  action: ModerationAction
  id?: string
  url?: string
  userId?: string
}

export type RecentComment = {
  id: string
  text: string
  url: string
  time: string
  user: { id: string; name: string }
}

const ID_RE = /^[A-Za-z0-9_.:-]{1,128}$/

/** Valida o corpo do POST /api/comentarios/moderar; null se inválido. */
export function parseModeration(body: unknown): ModerationRequest | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  const action = str(b['action'])
  if (action === 'apagar') {
    const id = str(b['id'])
    const url = str(b['url'])
    if (!ID_RE.test(id) || !/^https?:\/\//.test(url) || url.length > 2048) return null
    return { action, id, url }
  }
  if (action === 'bloquear' || action === 'desbloquear') {
    const userId = str(b['userId'])
    if (!ID_RE.test(userId)) return null
    return { action, userId }
  }
  return null
}

/** Método e URL (relativa ao upstream) da chamada de admin do Remark42. */
export function moderationCall(req: ModerationRequest, site: string) {
  const q = new URLSearchParams({ site })
  if (req.action === 'apagar') {
    q.set('url', req.url ?? '')
    return {
      method: 'DELETE',
      path: `/api/v1/admin/comment/${encodeURIComponent(req.id ?? '')}?${q}`,
    }
  }
  q.set('block', req.action === 'bloquear' ? '1' : '0')
  return { method: 'PUT', path: `/api/v1/admin/user/${encodeURIComponent(req.userId ?? '')}?${q}` }
}

/** Resume a resposta de /api/v1/last do Remark42 (sem IP/e-mail). */
export function toRecent(raw: unknown): RecentComment[] {
  if (!Array.isArray(raw)) return []
  const obj = (v: unknown) => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})
  return raw.flatMap((c) => {
    const o = obj(c)
    if (typeof o['id'] !== 'string' || o['delete']) return []
    const user = obj(o['user'])
    const orig = typeof o['orig'] === 'string' ? o['orig'] : ''
    return [
      {
        id: o['id'],
        text: orig || String(o['text'] ?? ''),
        url: String(obj(o['locator'])['url'] ?? ''),
        time: String(o['time'] ?? ''),
        user: { id: String(user['id'] ?? ''), name: String(user['name'] ?? '') },
      },
    ]
  })
}

export function adminAuthHeader(env: Env = process.env): string | null {
  const pass = env['REMARK_ADMIN_PASSWD']
  if (!pass) return null
  return `Basic ${Buffer.from(`admin:${pass}`).toString('base64')}`
}
