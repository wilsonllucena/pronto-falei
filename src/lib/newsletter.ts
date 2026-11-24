/**
 * Newsletter self-hosted (Listmonk, passo 13), pelo próprio domínio:
 * - o formulário do blog chama POST /api/newsletter/inscrever (servidor do
 *   app), que repassa pra API pública de inscrição do Listmonk (confirmação
 *   dupla: o Listmonk manda o e-mail com o link de confirmação);
 * - as páginas públicas do Listmonk (confirmar, descadastrar, preferências)
 *   ficam em /newsletter/subscription/*, repassadas pelo proxy do app; os
 *   arquivos delas vêm de /public/static/* (caminho absoluto do Listmonk).
 *   O admin e a API do Listmonk NÃO passam (painel só na LAN/Tailscale).
 *
 * Env: LISTMONK_INTERNAL_URL (ex.: http://listmonk:9000), LISTMONK_LIST_UUID
 * (gravado pelo scripts/setup-listmonk.py) e NEWSLETTER_ENABLED=true (o
 * compose liga quando há SMTP configurado; sem SMTP o formulário fica oculto).
 */
type Env = Record<string, string | undefined>

export const NEWSLETTER_PREFIX = '/newsletter'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function listmonkUpstream(env: Env = process.env): string | null {
  const raw = env['LISTMONK_INTERNAL_URL']?.trim()
  if (!raw) return null
  try {
    const u = new URL(raw)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return `${u.origin}${u.pathname.replace(/\/+$/, '')}`
  } catch {
    return null
  }
}

/** Formulário ligado só com Listmonk, lista e SMTP (NEWSLETTER_ENABLED=true). */
export function newsletterConfig(env: Env = process.env) {
  const upstream = listmonkUpstream(env)
  const listUuid = env['LISTMONK_LIST_UUID']?.trim() ?? ''
  if (!upstream || !UUID_RE.test(listUuid) || env['NEWSLETTER_ENABLED']?.trim() !== 'true')
    return null
  return { upstream, listUuid }
}

export const newsletterEnabled = (env: Env = process.env) => newsletterConfig(env) !== null

/** Páginas públicas do Listmonk que passam pelo proxy (sob /newsletter). */
const PUBLIC_UNDER_PREFIX = ['/subscription/', '/campaign/', '/link/']
/** Arquivos que as páginas do Listmonk pedem pela raiz do domínio. */
const PUBLIC_AT_ROOT = ['/public/static/', '/public/custom.css', '/public/custom.js']

/**
 * /newsletter/subscription/optin/x?l=y → <upstream>/subscription/optin/x?l=y
 * (null = não é do Listmonk). Admin, API e o resto ficam de fora.
 */
export function listmonkTarget(pathname: string, search: string, env: Env = process.env) {
  const upstream = listmonkUpstream(env)
  if (!upstream) return null
  if (pathname.split('/').some((seg) => seg === '..' || seg === '.')) return null
  if (PUBLIC_AT_ROOT.some((p) => (p.endsWith('/') ? pathname.startsWith(p) : pathname === p)))
    return `${upstream}${pathname}${search}`
  if (!pathname.startsWith(`${NEWSLETTER_PREFIX}/`)) return null
  const rest = pathname.slice(NEWSLETTER_PREFIX.length)
  if (rest === '/subscription/form') return null // o formulário é o do blog
  if (!PUBLIC_UNDER_PREFIX.some((p) => rest.startsWith(p))) return null
  return `${upstream}${rest}${search}`
}

/** Cabeçalhos pro Listmonk: sem cookies nem Authorization do blog, com o IP real. */
export function listmonkRequestHeaders(from: Headers): Headers {
  const out = new Headers(from)
  out.delete('cookie')
  out.delete('authorization')
  const ip = clientIp(from)
  if (ip) {
    out.set('x-real-ip', ip)
    out.set('x-forwarded-for', ip)
  }
  return out
}

export function clientIp(h: Headers): string {
  return (
    h.get('cf-connecting-ip')?.trim() ||
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip')?.trim() ||
    ''
  )
}

export type Subscription = { email: string; spam: boolean }

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[a-z]{2,}$/i

/** Valida o corpo do formulário. `website` é o campo-isca (robôs preenchem). */
export function parseSubscription(body: unknown): Subscription | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  const email = typeof b['email'] === 'string' ? b['email'].trim().toLowerCase() : ''
  if (email.length > 254 || !EMAIL_RE.test(email)) return null
  const trap = typeof b['website'] === 'string' ? b['website'].trim() : ''
  return { email, spam: trap.length > 0 }
}

/** Limite simples em memória (por IP e por e-mail). */
export function createLimiter(max: number, windowMs: number) {
  const hits = new Map<string, number[]>()
  return {
    allow(key: string, now = Date.now()): boolean {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
      if (recent.length >= max) {
        hits.set(key, recent)
        return false
      }
      recent.push(now)
      hits.set(key, recent)
      if (hits.size > 5000) {
        for (const [k, v] of hits) if (v.every((t) => now - t >= windowMs)) hits.delete(k)
      }
      return true
    },
  }
}
