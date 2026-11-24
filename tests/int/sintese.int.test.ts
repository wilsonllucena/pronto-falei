import { type ChildProcess, spawn } from 'node:child_process'
import { createServer } from 'node:net'

import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { summaryStatus } from '@/endpoints/summary'
import { AI_QUEUE, GENERATE_SUMMARY } from '@/jobs/generateSummary'
import { lexicalFromBlocks } from '@/lib/lexicalBuilder'
import config from '@/payload.config'

/**
 * Passo 8: job generateSummary de ponta a ponta com o mock do llama.cpp
 * (llm/mock/server.mjs, o mesmo do CI), sem baixar modelo.
 */
let payload: Payload
let mock: ChildProcess
const run = Date.now().toString(36)
const created: string[] = []

const freePort = () =>
  new Promise<number>((resolve) => {
    const s = createServer().listen(0, () => {
      const port = (s.address() as { port: number }).port
      s.close(() => resolve(port))
    })
  })

const content = lexicalFromBlocks([
  'Montei um homelab com um mini PC usado pra rodar meus projetos sem pagar nuvem. Foi a melhor decisão do ano.',
  { heading: 'Por que um modelo pequeno' },
  'Resumir texto não precisa de modelo gigante. Um 4B quantizado dá conta e cabe em 3 GB de RAM.',
  { code: 'llama-server -m modelo.gguf', language: 'bash' },
  { heading: 'O que eu aprendi' },
  'Fila com um job por vez evita travar o servidor. E dormir quando parado libera a memória.',
])

const published = {
  summary:
    'Síntese manual que já está no ar e não pode mudar sozinha quando a IA gera uma sugestão nova, porque a sugestão vai pro rascunho e só publica depois de revisada pelo autor do blog.',
  keyPoints: [{ text: 'Um' }, { text: 'Dois' }, { text: 'Três' }],
  summarySource: 'manual',
}

async function newPost(title: string, publish = false) {
  const doc = await payload.create({
    collection: 'posts',
    draft: !publish,
    data: {
      title: `${title} ${run}`,
      subtitle: 'Um mini PC resolve',
      _status: publish ? 'published' : 'draft',
      content,
      ...(publish ? published : {}),
    } as never,
  })
  created.push(String(doc.id))
  return doc
}

async function runJob(postId: string) {
  const job = await payload.jobs.queue({
    task: GENERATE_SUMMARY,
    input: { postId },
    queue: AI_QUEUE,
  })
  await payload.jobs.runByID({ id: job.id })
  return payload.findByID({ collection: 'payload-jobs', id: job.id, depth: 0 })
}

describe('síntese com a IA local (passo 8)', () => {
  beforeAll(async () => {
    const port = await freePort()
    mock = spawn(process.execPath, ['llm/mock/server.mjs'], {
      env: { ...process.env, PORT: String(port), MOCK_DELAY_MS: '20' },
      stdio: 'ignore',
    })
    process.env.LLM_BASE_URL = `http://127.0.0.1:${port}/v1`
    process.env.LLM_TIMEOUT_MS = '15000'
    for (let i = 0; i < 50; i++) {
      if (
        await fetch(`http://127.0.0.1:${port}/health`).then(
          (r) => r.ok,
          () => false,
        )
      )
        break
      await new Promise((r) => setTimeout(r, 100))
    }
    payload = await getPayload({ config: await config })
  })
  afterAll(async () => {
    for (const id of created)
      await payload.delete({ collection: 'posts', id }).catch(() => undefined)
    await payload.delete({
      collection: 'payload-jobs',
      where: { taskSlug: { equals: GENERATE_SUMMARY } },
    })
    mock?.kill()
    await payload.destroy()
  })

  it('rascunho: grava síntese, pontos-chave, origem, modelo e data', async () => {
    const post = await newPost('Rascunho da IA')
    const before = Date.now()
    const job = (await runJob(String(post.id))) as unknown as {
      completedAt?: string
      hasError?: boolean
      log: { state: string; output: { model: string; durationMs: number } }[]
    }
    expect(job.hasError).toBeFalsy()
    expect(job.completedAt).toBeTruthy()
    expect(job.log.at(-1)?.output.model).toBe('mock-llm')

    const doc = await payload.findByID({ collection: 'posts', id: post.id, draft: true })
    expect(doc.summary?.startsWith(`Neste post eu falo sobre Rascunho da IA ${run}.`)).toBe(true)
    expect(doc.summary!.length).toBeGreaterThanOrEqual(160)
    expect(doc.summary!.length).toBeLessThanOrEqual(400)
    expect(doc.keyPoints?.length).toBeGreaterThanOrEqual(3)
    expect(doc.keyPoints?.[0].text).toBe('Explico por que um modelo pequeno.')
    expect(doc).toMatchObject({
      summarySource: 'ia',
      summaryReviewed: false,
      summaryModel: 'mock-llm',
      _status: 'draft',
    })
    expect(Date.parse(doc.summaryGeneratedAt!)).toBeGreaterThanOrEqual(before - 1000)

    const st = await summaryStatus(payload, doc)
    expect(st.status).toBe('done')
    if (st.status === 'done') {
      expect(st.result.summary).toBe(doc.summary)
      expect(st.result.keyPoints).toEqual(doc.keyPoints?.map((k) => k.text))
    }
  })

  it('post publicado: a sugestão vai pro rascunho, o site não muda', async () => {
    const post = await newPost('Publicado da IA', true)
    await runJob(String(post.id))
    const live = await payload.find({
      collection: 'posts',
      where: { id: { equals: post.id } },
      draft: false,
      overrideAccess: false,
    })
    expect(live.docs[0].summary).toBe(published.summary)
    expect(live.docs[0].summarySource).toBe('manual')
    const draft = await payload.findByID({ collection: 'posts', id: post.id, draft: true })
    expect(draft.summarySource).toBe('ia')
    expect(draft.summary).not.toBe(published.summary)

    // publicar a sugestão sem revisar é recusado; revisada, publica
    await expect(
      payload.update({
        collection: 'posts',
        id: post.id,
        data: { _status: 'published' },
      }),
    ).rejects.toThrow(/Síntese revisada|revise/i)
    const ok = await payload.update({
      collection: 'posts',
      id: post.id,
      data: { _status: 'published', summaryReviewed: true },
    })
    expect(ok.summary).toBe(draft.summary)
  })

  it('IA com erro: job falha com mensagem clara e oferece o extrativo', async () => {
    const post = await newPost('[llm-erro] Falha')
    const job = (await runJob(String(post.id))) as unknown as { hasError?: boolean }
    expect(job.hasError).toBe(true)
    const st = await summaryStatus(payload, post)
    expect(st.status).toBe('error')
    if (st.status === 'error') {
      expect(st.error).toContain('a IA respondeu 500')
      expect(st.fallback?.summary.startsWith('Um mini PC resolve. Montei um homelab')).toBe(true)
      expect(st.fallback?.keyPoints.length).toBeGreaterThanOrEqual(3)
    }
    // nada foi gravado no post
    const doc = await payload.findByID({ collection: 'posts', id: post.id, draft: true })
    expect(doc.summary ?? null).toBeNull()
  })

  it('resposta fora das regras é recusada pela validação', async () => {
    const post = await newPost('[llm-invalido] Curto')
    await runJob(String(post.id))
    const st = await summaryStatus(payload, post)
    expect(st.status).toBe('error')
    if (st.status === 'error') expect(st.error).toMatch(/fora do formato: summary curto/)
  })

  it('IA fora do ar vira erro, sem travar', async () => {
    const saved = process.env.LLM_BASE_URL
    process.env.LLM_BASE_URL = `http://127.0.0.1:${await freePort()}/v1`
    try {
      const post = await newPost('IA fora')
      await runJob(String(post.id))
      const st = await summaryStatus(payload, post)
      expect(st.status).toBe('error')
      if (st.status === 'error') expect(st.error).toContain('não deu pra falar com a IA')
    } finally {
      process.env.LLM_BASE_URL = saved
    }
  })

  it('sem job ainda: status idle', async () => {
    const post = await newPost('Sem job')
    expect(await summaryStatus(payload, post)).toEqual({ status: 'idle' })
  })
})
