/**
 * Síntese com a IA local (passo 8): prompt, schema, preparo do texto,
 * validação da resposta e o resumo extrativo de reserva. Tudo puro (sem rede),
 * pra testar sem o modelo. O prompt e o schema são os do teste em
 * pronto-falei-plan/llm-test (system.txt e schema.json).
 */
import { lexicalToMarkdown } from '../serialize'
import { KEY_POINT_MAX, KEY_POINTS_MAX, KEY_POINTS_MIN, SUMMARY_MAX, SUMMARY_MIN } from '../summary'

export const SYSTEM_PROMPT = `Você é o editor do blog "Pronto, Falei!". Sua única tarefa é resumir o post que o usuário enviar, em português do Brasil.
Regras:
- Use somente informações que estão no texto. Não invente fatos, números, nomes nem opiniões.
- Mantenha a voz do autor: primeira pessoa, direta, sem rodeios e sem clichês de marketing.
- "summary": de 2 a 3 frases completas, entre ${SUMMARY_MIN} e ${SUMMARY_MAX} caracteres, em primeira pessoa como o autor, dizendo a ideia central e a conclusão.
- "keyPoints": de ${KEY_POINTS_MIN} a ${KEY_POINTS_MAX} itens, cada um com uma frase curta de até ${KEY_POINT_MAX} caracteres, sem repetir o summary.
- Não use markdown, emojis nem aspas tipográficas.
- Responda apenas com o JSON no formato pedido.`

/** JSON schema forçado por gramática no llama.cpp (folga acima das regras do post). */
export const SUMMARY_JSON_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', minLength: 120, maxLength: 600 },
    keyPoints: {
      type: 'array',
      minItems: 3,
      maxItems: 5,
      items: { type: 'string', maxLength: 200 },
    },
  },
  required: ['summary', 'keyPoints'],
  additionalProperties: false,
} as const

export const CODE_PLACEHOLDER = '[código]'
/** Caracteres por token em pt-BR, com folga (medido: ~3,8 no post de teste). */
export const CHARS_PER_TOKEN = 3.5

export type SummaryInput = {
  title: string
  subtitle?: string | null
  content: unknown
}

export type SummaryResult = { summary: string; keyPoints: string[] }

export type ChatMessage = { role: 'system' | 'user'; content: string }

/** Lexical → Markdown sem código (vira "[código]") e com links relativos. */
export function postToPromptText(content: unknown): string {
  return lexicalToMarkdown(content, { absolute: (p) => p, codePlaceholder: CODE_PLACEHOLDER })
    .replace(/(\[código\]\s*){2,}/g, `${CODE_PLACEHOLDER}\n\n`)
    .trim()
}

export const estimateTokens = (text: string) => Math.ceil(text.length / CHARS_PER_TOKEN)

/**
 * Corta o texto em partes de até maxTokens (estimados), sempre entre
 * parágrafos; um parágrafo gigante é quebrado em frases.
 */
export function splitChunks(text: string, maxTokens: number): string[] {
  const maxChars = Math.max(200, Math.floor(maxTokens * CHARS_PER_TOKEN))
  if (text.length <= maxChars) return [text]
  const pieces: string[] = []
  for (const para of text.split(/\n{2,}/)) {
    if (para.length <= maxChars) {
      pieces.push(para)
      continue
    }
    let buf = ''
    for (const sentence of para.match(/[^.!?]+[.!?]*\s*/g) ?? [para]) {
      if ((buf + sentence).length > maxChars && buf) {
        pieces.push(buf.trim())
        buf = ''
      }
      buf += sentence.length > maxChars ? sentence.slice(0, maxChars) : sentence
    }
    if (buf.trim()) pieces.push(buf.trim())
  }
  const chunks: string[] = []
  let cur = ''
  for (const p of pieces) {
    if (cur && cur.length + p.length + 2 > maxChars) {
      chunks.push(cur)
      cur = ''
    }
    cur = cur ? `${cur}\n\n${p}` : p
  }
  if (cur) chunks.push(cur)
  return chunks
}

function header(input: SummaryInput): string {
  const sub = input.subtitle?.trim()
  return `Título: ${input.title.trim()}${sub ? `\nLinha fina: ${sub}` : ''}`
}

/** Mensagens de um post que cabe numa chamada só. */
export function singleMessages(input: SummaryInput, text: string): ChatMessage[] {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `${header(input)}\n\nResuma este post:\n\n${text}` },
  ]
}

/** Etapa "map": resumo de uma parte de um post longo. */
export function chunkMessages(
  input: SummaryInput,
  chunk: string,
  index: number,
  total: number,
): ChatMessage[] {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `${header(input)}\n\nEste post é longo e foi dividido em ${total} partes. Resuma só a parte ${index + 1}:\n\n${chunk}`,
    },
  ]
}

/** Etapa "reduce": junta os resumos das partes num resumo do post inteiro. */
export function reduceMessages(input: SummaryInput, parts: SummaryResult[]): ChatMessage[] {
  const body = parts
    .map((p, i) => `Parte ${i + 1}: ${p.summary}\n${p.keyPoints.map((k) => `- ${k}`).join('\n')}`)
    .join('\n\n')
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `${header(input)}\n\nAbaixo estão os resumos de cada parte do post. Junte tudo num resumo só do post inteiro:\n\n${body}`,
    },
  ]
}

/** Corpo do POST /v1/chat/completions (o mesmo do teste). */
export function chatBody(messages: ChatMessage[], maxTokens = 450) {
  return {
    messages,
    temperature: 0.2,
    max_tokens: maxTokens,
    stream: false,
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'sintese', schema: SUMMARY_JSON_SCHEMA },
    },
  }
}

/* ------------------------------ validação ------------------------------ */

export class SummaryValidationError extends Error {
  constructor(public problems: string[]) {
    super(`Resposta da IA fora do formato: ${problems.join('; ')}`)
    this.name = 'SummaryValidationError'
  }
}

/** Tira markdown, emojis, aspas tipográficas e espaços repetidos. */
export function cleanText(s: string): string {
  return s
    .replace(/[“”„«»]/g, '"')
    .replace(/[‘’‚]/g, "'")
    .replace(/\p{Extended_Pictographic}\uFE0F?/gu, '')
    .replace(/\*\*|__|`/g, '')
    .replace(/(^|\s)[*_](\S[^*_]*\S|\S)[*_](?=\s|[.,;:!?]|$)/g, '$1$2')
    .replace(/^\s*(#{1,6}\s+|[-*•]\s+|\d+[.)]\s+)/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Corta em até `max` caracteres na última frase completa; se não houver
 * frase que caiba, corta na última palavra e põe reticências.
 */
export function cutAtSentence(s: string, max: number): string {
  if (s.length <= max) return s
  const head = s.slice(0, max + 1)
  const m = [...head.matchAll(/[.!?](?=\s|$)/g)].pop()
  if (m && m.index !== undefined && m.index + 1 >= max * 0.4) return head.slice(0, m.index + 1)
  const cut = head.slice(0, max - 1)
  const sp = cut.lastIndexOf(' ')
  return `${(sp > max * 0.5 ? cut.slice(0, sp) : cut).replace(/[\s,;:–-]+$/, '')}…`
}

/** Lê o JSON (tolerando cerca ```json) e aplica as regras do post. */
export function normalizeSummary(raw: unknown): SummaryResult {
  let data = raw
  if (typeof raw === 'string') {
    const txt = raw
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```$/, '')
    try {
      data = JSON.parse(txt)
    } catch {
      throw new SummaryValidationError(['não é um JSON válido'])
    }
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new SummaryValidationError(['esperava um objeto com summary e keyPoints'])
  }
  const obj = data as Record<string, unknown>
  const problems: string[] = []

  let summary = typeof obj.summary === 'string' ? cleanText(obj.summary) : ''
  if (!summary) problems.push('summary ausente')
  summary = cutAtSentence(summary, SUMMARY_MAX)
  if (summary && summary.length < SUMMARY_MIN) {
    problems.push(`summary curto (${summary.length} caracteres; mínimo ${SUMMARY_MIN})`)
  }

  const seen = new Set<string>([summary.toLowerCase()])
  const keyPoints: string[] = []
  for (const k of Array.isArray(obj.keyPoints) ? obj.keyPoints : []) {
    if (typeof k !== 'string') continue
    const t = cutAtSentence(cleanText(k), KEY_POINT_MAX)
    if (t.length < 3 || seen.has(t.toLowerCase())) continue
    seen.add(t.toLowerCase())
    keyPoints.push(t)
  }
  if (!Array.isArray(obj.keyPoints)) problems.push('keyPoints ausente')
  else if (keyPoints.length < KEY_POINTS_MIN) {
    problems.push(`só ${keyPoints.length} pontos-chave válidos (mínimo ${KEY_POINTS_MIN})`)
  }
  if (problems.length) throw new SummaryValidationError(problems)
  return { summary, keyPoints: keyPoints.slice(0, KEY_POINTS_MAX) }
}

/* --------------------------- resumo extrativo --------------------------- */

const plain = (md: string) =>
  cleanText(
    md
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/\\([\\`*_[\]<>])/g, '$1'),
  )

const sentences = (s: string) =>
  (s.match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g) ?? []).map((x) => x.trim()).filter(Boolean)

/**
 * Plano B quando a IA falha: linha fina + primeiro parágrafo (cortado na
 * frase) e, como pontos-chave, a primeira frase de cada seção. Nunca é
 * gravado sozinho: o admin oferece e marca a origem como "extrativo".
 */
export function extractiveSummary(input: SummaryInput): SummaryResult {
  const md = postToPromptText(input.content)
  const blocks = md.split(/\n{2,}/)
  const paragraphs = blocks
    .filter((b) => !/^(#{1,6}\s|>|[-*]\s|\d+\.\s|\[código\]|!\[)/.test(b.trim()))
    .map(plain)
    .filter((p) => p.length > 20)

  let summary = input.subtitle?.trim() ? cleanText(input.subtitle) : ''
  if (summary && !/[.!?]$/.test(summary)) summary += '.'
  for (const s of paragraphs.flatMap(sentences)) {
    if (summary.length >= SUMMARY_MIN) break
    summary = summary ? `${summary} ${s}` : s
  }
  summary = cutAtSentence(summary, SUMMARY_MAX)

  // primeira frase depois de cada título (h2/h3); completa com as próximas frases
  const keyPoints: string[] = []
  const used = new Set(sentences(summary).map((s) => s.toLowerCase()))
  const push = (s: string) => {
    const t = cutAtSentence(s, KEY_POINT_MAX)
    if (t.length >= 12 && !used.has(t.toLowerCase()) && keyPoints.length < KEY_POINTS_MAX) {
      used.add(t.toLowerCase())
      keyPoints.push(t)
    }
  }
  blocks.forEach((b, i) => {
    if (!/^#{2,3}\s/.test(b.trim())) return
    const next = blocks.slice(i + 1).find((x) => !/^(#|\[código\]|!\[)/.test(x.trim()))
    if (next) push(sentences(plain(next.replace(/^[-*>]\s*/gm, '')))[0] ?? '')
  })
  for (const s of paragraphs.flatMap(sentences)) {
    if (keyPoints.length >= KEY_POINTS_MIN) break
    push(s)
  }
  return { summary, keyPoints }
}
