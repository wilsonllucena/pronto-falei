/** Redirecionamentos: normalização do caminho e destino (funções puras). */

/** "/Antigo/" → "/antigo"; aceita URL completa e corta query e hash. */
export function normalizePath(input: string): string {
  let v = (input || '').trim()
  if (!v) return ''
  try {
    if (/^https?:\/\//i.test(v)) v = new URL(v).pathname
  } catch {
    return ''
  }
  v = v.split(/[?#]/)[0]
  if (!v.startsWith('/')) v = `/${v}`
  v = v.replace(/\/{2,}/g, '/')
  if (v.length > 1) v = v.replace(/\/+$/, '')
  try {
    v = decodeURI(v)
  } catch {
    // mantém como veio
  }
  return v.toLowerCase()
}

export type RedirectDoc = {
  from: string
  type?: '301' | '302' | null
  to?: {
    type?: 'reference' | 'custom' | null
    url?: string | null
    reference?: {
      relationTo: string
      value: string | { slug?: string | null; _status?: string | null }
    } | null
  } | null
}

/** Caminho público de um documento referenciado (post ou página). */
export function referencePath(relationTo: string, slug: string): string {
  if (relationTo === 'posts') return `/posts/${slug}`
  return `/${slug}`
}

/** Destino do redirecionamento, ou null se estiver incompleto ou apontar pra ele mesmo. */
export function redirectTarget(doc: RedirectDoc): { to: string; permanent: boolean } | null {
  const permanent = doc.type !== '302'
  let to: string | null = null
  if (doc.to?.type === 'custom') {
    const url = doc.to.url?.trim()
    if (url && (/^https?:\/\//i.test(url) || url.startsWith('/'))) to = url
  } else {
    const ref = doc.to?.reference
    if (ref && typeof ref.value === 'object' && ref.value?.slug) {
      if (ref.value._status && ref.value._status !== 'published') return null
      to = referencePath(ref.relationTo, ref.value.slug)
    }
  }
  if (!to) return null
  if (to.startsWith('/') && normalizePath(to) === normalizePath(doc.from)) return null
  return { to, permanent }
}
