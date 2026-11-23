/** Palavras por minuto usadas no tempo de leitura (plano: 220). */
export const WORDS_PER_MINUTE = 220

type LexicalNode = {
  type?: string
  text?: string
  children?: LexicalNode[]
  fields?: Record<string, unknown>
}

type LexicalState = { root?: LexicalNode } | null | undefined

const BLOCK_TEXT_FIELDS = ['code', 'text', 'content', 'title', 'caption']

/**
 * Extrai o texto "lido" de um documento Lexical. Blocos de código contam
 * (quem lê passa os olhos), embeds não.
 */
export function lexicalToPlainText(state: LexicalState): string {
  const parts: string[] = []
  const walk = (node: LexicalNode | undefined) => {
    if (!node) return
    if (typeof node.text === 'string') parts.push(node.text)
    if (node.type === 'linebreak') parts.push('\n')
    if ((node.type === 'block' || node.type === 'upload') && node.fields) {
      for (const key of BLOCK_TEXT_FIELDS) {
        const v = node.fields[key]
        if (typeof v === 'string') parts.push(v)
      }
    }
    if (Array.isArray(node.children)) {
      node.children.forEach(walk)
      parts.push(' ')
    }
  }
  walk(state?.root)
  return parts.join('').replace(/\s+/g, ' ').trim()
}

export function countWords(text: string): number {
  const words = text.match(/[\p{L}\p{N}][\p{L}\p{N}'’_-]*/gu)
  return words ? words.length : 0
}

/** Minutos de leitura, arredondado pra cima, mínimo 1 quando há texto. */
export function readingTimeMinutes(wordCount: number, wpm = WORDS_PER_MINUTE): number {
  if (wordCount <= 0) return 0
  return Math.max(1, Math.ceil(wordCount / wpm))
}

export function readingStats(state: LexicalState): { wordCount: number; readingTime: number } {
  const wordCount = countWords(lexicalToPlainText(state))
  return { wordCount, readingTime: readingTimeMinutes(wordCount) }
}
