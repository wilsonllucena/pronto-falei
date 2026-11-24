/**
 * Analytics self-hosted (Umami, passo 11). O navegador só fala com o próprio
 * blog: /stats/script.js e /stats/api/send são repassados pro container do
 * Umami na rede interna. O painel do Umami não passa por aqui (fica só na
 * LAN/Tailscale). Sem cookies; respeita Do Not Track por padrão.
 *
 * Env: UMAMI_INTERNAL_URL (ex.: http://umami:3000), UMAMI_WEBSITE_ID,
 * UMAMI_DOMAINS (padrão: host da NEXT_PUBLIC_SERVER_URL; visitas por outros
 * hosts, como Tailscale e LAN, não contam), UMAMI_RESPECT_DNT (padrão true).
 */
type Env = Record<string, string | undefined>

export type TrackerConfig = { websiteId: string; domains: string; doNotTrack: boolean }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function umamiUpstream(env: Env = process.env): string | null {
  const raw = env['UMAMI_INTERNAL_URL']?.trim()
  if (!raw) return null
  try {
    const u = new URL(raw)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return `${u.origin}${u.pathname.replace(/\/+$/, '')}`
  } catch {
    return null
  }
}

function hostOf(url: string | undefined): string {
  try {
    return url ? new URL(url).hostname : ''
  } catch {
    return ''
  }
}

export function trackerConfig(env: Env = process.env): TrackerConfig | null {
  const websiteId = env['UMAMI_WEBSITE_ID']?.trim() ?? ''
  if (!UUID.test(websiteId) || !umamiUpstream(env)) return null
  const domains = (env['UMAMI_DOMAINS']?.trim() || hostOf(env['NEXT_PUBLIC_SERVER_URL']))
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean)
    .join(',')
  return { websiteId, domains, doNotTrack: env['UMAMI_RESPECT_DNT'] !== 'false' }
}

/** Cabeçalhos que o Umami usa (navegador, idioma, IP/país vindos do Cloudflare). */
const FORWARD = [
  'content-type',
  'user-agent',
  'accept-language',
  'x-umami-cache',
  'x-umami-website-id',
  'x-umami-hostname',
  'cf-connecting-ip',
  'cf-ipcountry',
  'cf-region-code',
  'cf-ipcity',
  'x-forwarded-for',
  'x-real-ip',
]

export function forwardHeaders(from: Headers): Headers {
  const out = new Headers()
  for (const name of FORWARD) {
    const v = from.get(name)
    if (v) out.set(name, v)
  }
  return out
}

/** Limite do corpo de um evento (o tracker manda bem menos que isso). */
export const MAX_EVENT_BYTES = 64 * 1024
