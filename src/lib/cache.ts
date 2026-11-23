/**
 * Cache de dados com tags (ISR sob demanda). Dentro do servidor Next usa o
 * `unstable_cache`; fora dele (testes de integração, scripts) chama direto.
 */
import { unstable_cache } from 'next/cache'

/** Rede de segurança: mesmo sem invalidação, o dado expira em 1 h. */
export const CACHE_SAFETY_SECONDS = 3600

export function cached<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
  key: string,
  tags: (...args: A) => string[],
): (...args: A) => Promise<R> {
  return (...args: A) => {
    if (!process.env.NEXT_RUNTIME) return fn(...args)
    return unstable_cache(() => fn(...args), [key, JSON.stringify(args)], {
      tags: tags(...args),
      revalidate: CACHE_SAFETY_SECONDS,
    })()
  }
}
