import { NextResponse, type NextRequest } from 'next/server'

import { canonicalRedirect, requestHost } from './lib/hostRedirect'
import { remarkRequestHeaders, remarkTarget } from './lib/remark'

/**
 * - www.dominio → dominio (308), conforme CANONICAL_REDIRECT_HOSTS.
 * - /comentarios/* → Remark42 na rede interna (passo 12).
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
  return NextResponse.next()
}
