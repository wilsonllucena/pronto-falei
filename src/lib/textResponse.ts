/** Resposta de texto pros robôs: tipo certo, UTF-8 e cache curto na borda. */
export function textResponse(
  body: string,
  type: string,
  extra: Record<string, string> = {},
): Response {
  return new Response(body, {
    headers: {
      'Content-Type': `${type}; charset=utf-8`,
      'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=600',
      'X-Content-Type-Options': 'nosniff',
      ...extra,
    },
  })
}

export const notFoundText = () =>
  new Response('Não encontrado.\n', {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
