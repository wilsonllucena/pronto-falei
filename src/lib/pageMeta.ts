import type { Metadata } from 'next'

type OpenGraph = NonNullable<Metadata['openGraph']>

/**
 * Canônico + og:url de uma página de listagem/institucional. Os caminhos são
 * relativos: o metadataBase do layout (NEXT_PUBLIC_SERVER_URL) os torna
 * absolutos, então o mesmo build serve dev, Tailscale e o domínio.
 */
export function pageMeta(path: string, og: Partial<OpenGraph> = {}): Metadata {
  return {
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      siteName: 'Pronto, Falei!',
      locale: 'pt_BR',
      url: path,
      ...og,
    } as OpenGraph,
  }
}
