/**
 * Origens aceitas pelo Payload (CSRF do cookie de login e CORS da API).
 * PAYLOAD_ALLOWED_ORIGINS: lista separada por vírgula, ex.:
 *   https://<dominio>,http://<host-tailscale>:3130,http://<ip-lan>:3130
 * Sem a lista, vale só a origem da NEXT_PUBLIC_SERVER_URL (dev e CI).
 * Valores inválidos são ignorados; nunca devolve lista vazia se houver URL
 * pública, porque lista vazia no Payload desliga a checagem.
 */
type Env = Record<string, string | undefined>

function origin(value: string): string | null {
  try {
    const u = new URL(value.trim())
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.origin
  } catch {
    return null
  }
}

export function allowedOrigins(env: Env = process.env): string[] {
  const listed = (env['PAYLOAD_ALLOWED_ORIGINS'] ?? '')
    .split(',')
    .filter((v) => v.trim())
    .map(origin)
    .filter((v): v is string => Boolean(v))
  const fallback = origin(env['NEXT_PUBLIC_SERVER_URL'] ?? '')
  const all = listed.length ? listed : fallback ? [fallback] : []
  return [...new Set(all)]
}
