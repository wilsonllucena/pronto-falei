/**
 * Redireciona hosts alternativos (ex.: www.wilsonlima.dev) pro host canônico da
 * URL pública (NEXT_PUBLIC_SERVER_URL), mantendo caminho e query. Configurável
 * por env: CANONICAL_REDIRECT_HOSTS="www.wilsonlima.dev,outro.dominio".
 * Hosts fora da lista (Tailscale, LAN, localhost) seguem sem redirecionar.
 */
export function redirectHosts(env: Record<string, string | undefined> = process.env): string[] {
  return (env['CANONICAL_REDIRECT_HOSTS'] || '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean)
}

/** Host da requisição sem porta, em minúsculas (respeita x-forwarded-host). */
export function requestHost(headers: Headers): string {
  const raw = headers.get('x-forwarded-host') || headers.get('host') || ''
  return raw.split(',')[0].trim().toLowerCase().replace(/:\d+$/, '')
}

/** URL de destino (string) ou null quando não precisa redirecionar. */
export function canonicalRedirect(
  host: string,
  pathAndQuery: string,
  env: Record<string, string | undefined> = process.env,
): string | null {
  const hosts = redirectHosts(env)
  if (!host || !hosts.includes(host)) return null
  const base = env['NEXT_PUBLIC_SERVER_URL']
  if (!base) return null
  let target: URL
  try {
    target = new URL(base)
  } catch {
    return null
  }
  if (target.hostname.toLowerCase() === host) return null // evita loop
  const path = pathAndQuery.startsWith('/') ? pathAndQuery : `/${pathAndQuery}`
  return `${target.origin}${path}`
}
