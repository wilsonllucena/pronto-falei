export const SITE_NAME = 'Pronto, Falei!'

export function seoTitle(doc: { title?: string | null }): string {
  return doc.title ? `${doc.title} · ${SITE_NAME}` : SITE_NAME
}

/** meta description = summary (TL;DR); se não tiver, a linha fina. Corta em 160. */
export function seoDescription(doc: { summary?: string | null; subtitle?: string | null }): string {
  const text = (doc.summary || doc.subtitle || '').replace(/\s+/g, ' ').trim()
  if (text.length <= 160) return text
  const cut = text.slice(0, 157)
  const lastSpace = cut.lastIndexOf(' ')
  return `${cut.slice(0, lastSpace > 100 ? lastSpace : 157)}…`
}
