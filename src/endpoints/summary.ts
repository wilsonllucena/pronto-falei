import type { Endpoint, Payload, PayloadRequest } from 'payload'

import { AI_QUEUE, GENERATE_SUMMARY } from '../jobs/generateSummary'
import { extractiveSummary, type SummaryResult } from '../lib/llm/prompt'

export type SummaryStatus =
  | { status: 'idle' }
  | { status: 'queued' | 'running'; jobId: string; startedAt: string }
  | {
      status: 'done'
      jobId: string
      result: SummaryResult & { model: string; durationMs: number }
    }
  | { status: 'error'; jobId: string; error: string; fallback: SummaryResult | null }

type JobDoc = {
  id: string | number
  createdAt: string
  completedAt?: string | null
  processing?: boolean | null
  hasError?: boolean | null
  error?: unknown
  log?: { state?: string; output?: unknown; error?: unknown }[] | null
}

const json = (body: unknown, status = 200) => Response.json(body, { status })

function errorMessage(e: unknown): string | null {
  if (!e) return null
  if (typeof e === 'string') return e
  if (typeof e === 'object' && 'message' in e && typeof e.message === 'string') return e.message
  return null
}

async function latestJob(payload: Payload, postId: string, pendingOnly = false) {
  const res = await payload.find({
    collection: 'payload-jobs',
    where: {
      and: [
        { taskSlug: { equals: GENERATE_SUMMARY } },
        { 'input.postId': { equals: postId } },
        ...(pendingOnly
          ? [{ completedAt: { exists: false } }, { hasError: { not_equals: true } }]
          : []),
      ],
    },
    sort: '-createdAt',
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return (res.docs[0] as unknown as JobDoc) ?? null
}

async function loadPost(req: PayloadRequest) {
  const id = String(req.routeParams?.id ?? '')
  if (!id) return null
  return req.payload
    .findByID({ collection: 'posts', id, draft: true, depth: 0, req, disableErrors: true })
    .catch(() => null)
}

/** Estado do job mais recente da síntese de um post. */
export async function summaryStatus(
  payload: Payload,
  post: { id: string | number; title: string; subtitle?: string | null; content: unknown },
): Promise<SummaryStatus> {
  const job = await latestJob(payload, String(post.id))
  if (!job) return { status: 'idle' }
  const jobId = String(job.id)
  if (job.hasError) {
    const failed = [...(job.log ?? [])].reverse().find((l) => l.state === 'failed')
    const fallback = extractiveSummary(post)
    return {
      status: 'error',
      jobId,
      error: errorMessage(failed?.error) ?? errorMessage(job.error) ?? 'a IA não conseguiu resumir',
      fallback: fallback.summary ? fallback : null,
    }
  }
  if (job.completedAt) {
    const ok = [...(job.log ?? [])].reverse().find((l) => l.state === 'succeeded')
    return { status: 'done', jobId, result: ok?.output as never }
  }
  return { status: job.processing ? 'running' : 'queued', jobId, startedAt: job.createdAt }
}

/** POST /api/posts/:id/generate-summary — enfileira a síntese (só logado). */
export const generateSummaryEndpoint: Endpoint = {
  path: '/:id/generate-summary',
  method: 'post',
  handler: async (req) => {
    if (!req.user) return json({ error: 'Faça login no admin.' }, 401)
    const post = await loadPost(req)
    if (!post) return json({ error: 'Post não encontrado.' }, 404)
    const postId = String(post.id)

    // job repetido do mesmo post é descartado: devolve o que já está na fila
    const pending = await latestJob(req.payload, postId, true)
    if (pending) {
      return json({ jobId: String(pending.id), status: 'queued', reused: true }, 202)
    }
    const job = await req.payload.jobs.queue({
      task: GENERATE_SUMMARY,
      input: { postId },
      queue: AI_QUEUE,
    })
    // começa já; o autoRun da fila `ai` pega o que sobrar (ex.: reinício)
    void req.payload.jobs
      .runByID({ id: job.id })
      .catch((err) => req.payload.logger.error({ err, msg: '[síntese] falha ao rodar o job' }))
    return json({ jobId: String(job.id), status: 'queued', reused: false }, 202)
  },
}

/** GET /api/posts/:id/summary-status — o botão do admin consulta a cada 5 s. */
export const summaryStatusEndpoint: Endpoint = {
  path: '/:id/summary-status',
  method: 'get',
  handler: async (req) => {
    if (!req.user) return json({ error: 'Faça login no admin.' }, 401)
    const post = await loadPost(req)
    if (!post) return json({ error: 'Post não encontrado.' }, 404)
    return json(await summaryStatus(req.payload, post))
  },
}
