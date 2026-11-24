/**
 * Cliente do llama.cpp server (API compatível com a da OpenAI), só na rede
 * interna do compose. Uma chamada por vez, com timeout (AbortSignal) e uma
 * nova tentativa; post maior que o contexto é resumido por partes e depois
 * junta (map-reduce).
 */
import {
  chatBody,
  type ChatMessage,
  chunkMessages,
  estimateTokens,
  normalizeSummary,
  postToPromptText,
  reduceMessages,
  singleMessages,
  splitChunks,
  type SummaryInput,
  type SummaryResult,
} from './prompt'

export type LlmConfig = {
  baseUrl: string
  modelFile: string
  timeoutMs: number
  maxInputTokens: number
  attempts: number
}

export function llmConfig(env: Record<string, string | undefined> = process.env): LlmConfig {
  const num = (v: string | undefined, d: number) => {
    const n = Number(v)
    return Number.isFinite(n) && n > 0 ? n : d
  }
  return {
    baseUrl: (env.LLM_BASE_URL || 'http://llm:8080/v1').replace(/\/+$/, ''),
    modelFile: env.LLM_MODEL_FILE || 'Qwen3-4B-Instruct-2507-Q3_K_M.gguf',
    timeoutMs: num(env.LLM_TIMEOUT_MS, 360_000),
    maxInputTokens: num(env.LLM_MAX_INPUT_TOKENS, 3800),
    attempts: 2,
  }
}

/** Nome curto do modelo: "/models/Qwen3-4B….gguf" → "Qwen3-4B…". */
export const modelName = (m: string) => m.replace(/^.*\//, '').replace(/\.gguf$/i, '')

export class LlmError extends Error {
  constructor(
    message: string,
    public retriable = true,
  ) {
    super(message)
    this.name = 'LlmError'
  }
}

type Fetch = typeof fetch

export type CallStats = { calls: number; promptTokens: number; completionTokens: number }

/** Uma chamada ao /chat/completions, já validada. Tenta de novo uma vez. */
export async function chatSummary(
  messages: ChatMessage[],
  cfg: LlmConfig,
  stats: CallStats,
  fetchImpl: Fetch = fetch,
): Promise<{ result: SummaryResult; model: string }> {
  let last: unknown
  for (let attempt = 1; attempt <= cfg.attempts; attempt++) {
    try {
      stats.calls++
      const res = await fetchImpl(`${cfg.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chatBody(messages)),
        signal: AbortSignal.timeout(cfg.timeoutMs),
      })
      if (!res.ok) {
        const raw = await res.text().catch(() => '')
        let text = raw
        try {
          // llama.cpp responde {"error":{"message":"..."}}
          text = (JSON.parse(raw) as { error?: { message?: string } }).error?.message || raw
        } catch {}
        text = text.trim().slice(0, 200)
        throw new LlmError(`a IA respondeu ${res.status}${text ? `: ${text}` : ''}`)
      }
      const json = (await res.json()) as {
        model?: string
        choices?: { message?: { content?: string } }[]
        usage?: { prompt_tokens?: number; completion_tokens?: number }
      }
      stats.promptTokens += json.usage?.prompt_tokens ?? 0
      stats.completionTokens += json.usage?.completion_tokens ?? 0
      const content = json.choices?.[0]?.message?.content
      if (!content) throw new LlmError('a IA respondeu sem conteúdo')
      return {
        result: normalizeSummary(content),
        model: modelName(json.model || cfg.modelFile),
      }
    } catch (err) {
      last =
        err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')
          ? new LlmError(`a IA não respondeu em ${Math.round(cfg.timeoutMs / 1000)} s`)
          : err instanceof TypeError
            ? new LlmError(`não deu pra falar com a IA (${cfg.baseUrl})`)
            : err
    }
  }
  throw last
}

export type GenerateOutput = SummaryResult & {
  model: string
  durationMs: number
  chunks: number
  calls: number
  promptTokens: number
  completionTokens: number
}

/** Gera a síntese de um post (map-reduce se passar do limite de entrada). */
export async function generatePostSummary(
  input: SummaryInput,
  cfg: LlmConfig = llmConfig(),
  fetchImpl: Fetch = fetch,
): Promise<GenerateOutput> {
  const t0 = Date.now()
  const text = postToPromptText(input.content)
  if (estimateTokens(text) < 30) {
    throw new LlmError('o post tem pouco texto pra resumir', false)
  }
  const stats: CallStats = { calls: 0, promptTokens: 0, completionTokens: 0 }
  const chunks = splitChunks(text, cfg.maxInputTokens)
  let out: { result: SummaryResult; model: string }
  if (chunks.length === 1) {
    out = await chatSummary(singleMessages(input, text), cfg, stats, fetchImpl)
  } else {
    const parts: SummaryResult[] = []
    for (const [i, c] of chunks.entries()) {
      parts.push(
        (await chatSummary(chunkMessages(input, c, i, chunks.length), cfg, stats, fetchImpl))
          .result,
      )
    }
    out = await chatSummary(reduceMessages(input, parts), cfg, stats, fetchImpl)
  }
  return {
    ...out.result,
    model: out.model,
    durationMs: Date.now() - t0,
    chunks: chunks.length,
    ...stats,
  }
}
