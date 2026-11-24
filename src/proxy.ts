import { NextResponse, type NextRequest } from 'next/server'

import { canonicalRedirect, requestHost } from './lib/hostRedirect'

/** www.dominio → dominio (308), conforme CANONICAL_REDIRECT_HOSTS. */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const to = canonicalRedirect(requestHost(request.headers), `${pathname}${search}`)
  return to ? NextResponse.redirect(to, 308) : NextResponse.next()
}
