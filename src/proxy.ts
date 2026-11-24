import { NextResponse, type NextRequest } from 'next/server'

import { canonicalRedirect, requestHost } from './lib/hostRedirect'
import { listmonkRequestHeaders, listmonkTarget, NEWSLETTER_PREFIX } from './lib/newsletter'
import { remarkRequestHeaders, remarkTarget } from './lib/remark'

/**
 * - www.dominio → dominio (308), conforme CANONICAL_REDIRECT_HOSTS.
 * - /comentarios/* → Remark42 na rede interna (passo 12).
 * - /newsletter/subscription/* e /public/static/* → páginas públicas do
 *   Listmonk (passo 13); o formulário do Listmonk volta pro do blog.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const to = canonicalRedirect(requestHost(request.headers), `${pathname}${search}`)
  if (to) return NextResponse.redirect(to, 308)
  const remark = remarkTarget(pathname, search)
  if (remark) {
    return NextResponse.rewrite(remark, {
      request: { headers: remarkRequestHeaders(request.headers) },
    })
  }
  if (pathname === `${NEWSLETTER_PREFIX}/subscription/form`) {
    const form = request.nextUrl.clone()
    form.pathname = NEWSLETTER_PREFIX
    form.search = ''
    return NextResponse.redirect(form, 307)
  }
  const listmonk = listmonkTarget(pathname, search)
  if (listmonk) {
    return NextResponse.rewrite(listmonk, {
      request: { headers: listmonkRequestHeaders(request.headers) },
    })
  }
  return NextResponse.next()
}
