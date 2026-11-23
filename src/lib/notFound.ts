import { notFound, permanentRedirect, redirect } from 'next/navigation'

import { findRedirect } from './queries'

/**
 * Antes de responder 404, confere se o caminho tem redirecionamento
 * cadastrado no admin. O Next responde 308 (permanente) ou 307 (temporário),
 * que buscadores tratam como 301 e 302.
 */
export async function redirectOrNotFound(path: string): Promise<never> {
  const target = await findRedirect(path).catch((err) => {
    console.error('[redirects] falha ao consultar', path, err)
    return null
  })
  if (target) {
    if (target.permanent) permanentRedirect(target.to)
    redirect(target.to)
  }
  notFound()
}
