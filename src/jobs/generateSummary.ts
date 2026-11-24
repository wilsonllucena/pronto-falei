import type { Payload, TaskConfig } from 'payload'

import { generatePostSummary, llmConfig } from '../lib/llm/client'

export const GENERATE_SUMMARY = 'generateSummary'
export const AI_QUEUE = 'ai'

type Output = {
  summary: string
  keyPoints: string[]
  model: string
  durationMs: number
  chunks: number
}

/**
 * Lê o último rascunho do post, pede a síntese pra IA local e grava como
 * sugestão no rascunho (origem "ia", revisão desmarcada). Nunca publica:
 * pra ir pro ar, alguém revisa e marca "Síntese revisada".
 */
export async function runGenerateSummary(payload: Payload, postId: string): Promise<Output> {
  const post = await payload.findByID({
    collection: 'posts',
    id: postId,
    draft: true,
    depth: 0,
    overrideAccess: true,
  })
  const out = await generatePostSummary({
    title: post.title,
    subtitle: post.subtitle,
    content: post.content,
  })
  await payload.update({
    collection: 'posts',
    id: postId,
    draft: true,
    overrideAccess: true,
    context: { generatedSummary: true },
    data: {
      summary: out.summary,
      keyPoints: out.keyPoints.map((text) => ({ text })),
      summarySource: 'ia',
      summaryReviewed: false,
      summaryModel: out.model,
      summaryGeneratedAt: new Date().toISOString(),
    },
  })
  payload.logger.info(
    `[síntese] post ${postId}: ${out.model} em ${(out.durationMs / 1000).toFixed(1)} s, ` +
      `${out.calls} chamada(s), ${out.promptTokens}+${out.completionTokens} tokens`,
  )
  return {
    summary: out.summary,
    keyPoints: out.keyPoints,
    model: out.model,
    durationMs: out.durationMs,
    chunks: out.chunks,
  }
}

export const generateSummaryTask: TaskConfig<{
  input: { postId: string }
  output: Output
}> = {
  slug: GENERATE_SUMMARY,
  label: 'Gerar síntese com a IA local',
  // a nova tentativa já acontece dentro da chamada (llmConfig().attempts)
  retries: 0,
  // um post por vez: a IA roda com um slot só e 3 GB de RAM
  concurrency: { key: () => 'llm', exclusive: true },
  inputSchema: [{ name: 'postId', type: 'text', required: true }],
  outputSchema: [
    { name: 'summary', type: 'textarea', required: true },
    { name: 'keyPoints', type: 'json', required: true },
    { name: 'model', type: 'text', required: true },
    { name: 'durationMs', type: 'number', required: true },
    { name: 'chunks', type: 'number', required: true },
  ],
  handler: async ({ input, req }) => {
    // sem req: a chamada leva minutos e não pode segurar uma transação aberta
    const output = await runGenerateSummary(req.payload, String(input.postId))
    return { output }
  },
}

/** Timeout total de um job (pra mostrar no admin). */
export const jobTimeoutMs = () => llmConfig().timeoutMs * llmConfig().attempts
