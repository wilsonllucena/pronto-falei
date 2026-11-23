/**
 * Busca: normalização da consulta e trecho com os termos destacados.
 * Funções puras (testáveis sem banco). A consulta em si fica em queries.ts.
 */

/** Tamanho máximo da consulta aceita (o resto é cortado). */
export const SEARCH_MAX_QUERY = 100
export const SEARCH_PAGE_SIZE = 10

/** Palavras curtas demais ou comuns demais pra destacar. */
const STOPWORDS = new Set([
  'a',
  'o',
  'as',
  'os',
  'de',
  'da',
  'do',
  'das',
  'dos',
  'e',
  'em',
  'no',
  'na',
  'nos',
  'nas',
  'um',
  'uma',
  'que',
  'com',
  'por',
  'pra',
  'para',
  'se',
])

/** Tira acento e caixa, preservando o tamanho caractere a caractere. */
export function fold(ch: string): string {
  const f = ch.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  return f.length === 1 ? f : ch.toLowerCase().slice(0, 1) || ch
}

export function foldText(text: string): string {
  return Array.from(text, fold).join('')
}

/** Limpa a consulta vinda da URL: string, sem espaços sobrando, no máximo 100 caracteres. */
export function normalizeQuery(value: unknown): string {
  const raw = Array.isArray(value) ? value[0] : value
  if (typeof raw !== 'string') return ''
  return raw.replace(/\s+/g, ' ').trim().slice(0, SEARCH_MAX_QUERY)
}

/** Termos a destacar: sem acento, sem stopwords, sem repetição, do maior pro menor. */
export function searchTerms(query: string): string[] {
  const words = foldText(query).match(/[\p{L}\p{N}][\p{L}\p{N}_.-]*/gu) ?? []
  // plural simples vira radical ("modelos" destaca "modelo" e "modelos")
  const stems = words
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w))
    .map((w) => (w.length > 4 && w.endsWith('s') ? w.slice(0, -1) : w))
  const uniq = [...new Set(stems)]
  return uniq.sort((a, b) => b.length - a.length)
}

export type Segment = { text: string; hit: boolean }

type Range = [number, number]

function findRanges(text: string, terms: string[]): Range[] {
  if (!terms.length || !text) return []
  // Array.from pra contar por caractere (emoji etc.), igual ao fold
  const chars = Array.from(text)
  const folded = chars.map(fold).join('')
  const ranges: Range[] = []
  for (const term of terms) {
    let from = 0
    while (from <= folded.length - term.length) {
      const at = folded.indexOf(term, from)
      if (at < 0) break
      ranges.push([at, at + term.length])
      from = at + term.length
    }
  }
  ranges.sort((a, b) => a[0] - b[0] || b[1] - a[1])
  const merged: Range[] = []
  for (const r of ranges) {
    const last = merged[merged.length - 1]
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1])
    else merged.push([...r])
  }
  return merged
}

function toSegments(chars: string[], ranges: Range[], start: number, end: number): Segment[] {
  const out: Segment[] = []
  let cur = start
  for (const [a, b] of ranges) {
    if (b <= start || a >= end) continue
    const s = Math.max(a, start)
    const e = Math.min(b, end)
    if (s > cur) out.push({ text: chars.slice(cur, s).join(''), hit: false })
    out.push({ text: chars.slice(s, e).join(''), hit: true })
    cur = e
  }
  if (cur < end) out.push({ text: chars.slice(cur, end).join(''), hit: false })
  return out
}

/** Texto inteiro em segmentos, com os termos marcados (pro título). */
export function highlight(text: string, terms: string[]): Segment[] {
  const chars = Array.from(text)
  return toSegments(chars, findRanges(text, terms), 0, chars.length)
}

/**
 * Trecho em volta da primeira ocorrência de um termo (ou o começo do texto),
 * cortado em palavra inteira e com reticências quando corta.
 */
export function snippet(text: string, terms: string[], radius = 90): Segment[] {
  const clean = text.replace(/\s+/g, ' ').trim()
  const chars = Array.from(clean)
  if (!chars.length) return []
  const ranges = findRanges(clean, terms)
  const center = ranges[0]?.[0] ?? 0
  let start = ranges.length ? Math.max(0, center - radius) : 0
  let end = Math.min(chars.length, (ranges.length ? center : 0) + radius * 2)
  if (!ranges.length) end = Math.min(chars.length, radius * 2)
  // não corta palavra no meio
  if (start > 0) {
    const sp = chars.indexOf(' ', start)
    if (sp > -1 && sp < center) start = sp + 1
  }
  if (end < chars.length) {
    const sp = chars.lastIndexOf(' ', end)
    if (sp > start) end = sp
  }
  const segs = toSegments(chars, ranges, start, end)
  if (start > 0) segs.unshift({ text: '… ', hit: false })
  if (end < chars.length) segs.push({ text: ' …', hit: false })
  return segs
}

/** Escapa a consulta pra usar numa RegExp (busca parcial de reserva). */
export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Regex tolerante a acento pra um termo já sem acento ("acao" acha "ação").
 * Usada na busca parcial quando o índice de texto não acha nada.
 */
export function accentInsensitivePattern(term: string): string {
  const groups: Record<string, string> = {
    a: 'aáàâãä',
    e: 'eéèêë',
    i: 'iíìîï',
    o: 'oóòôõö',
    u: 'uúùûü',
    c: 'cç',
    n: 'nñ',
  }
  return Array.from(term, (ch) => (groups[ch] ? `[${groups[ch]}]` : escapeRegex(ch))).join('')
}
