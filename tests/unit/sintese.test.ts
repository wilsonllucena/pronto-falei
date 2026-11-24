import { describe, expect, it } from 'vitest'

import { lexicalFromBlocks } from '@/lib/lexicalBuilder'
import { generatePostSummary, LlmError, llmConfig, modelName } from '@/lib/llm/client'
import {
  chatBody,
  cleanText,
  cutAtSentence,
  estimateTokens,
  extractiveSummary,
  normalizeSummary,
  postToPromptText,
  reduceMessages,
  singleMessages,
  splitChunks,
  SUMMARY_JSON_SCHEMA,
  SummaryValidationError,
  SYSTEM_PROMPT,
} from '@/lib/llm/prompt'
import { validateSummaryReviewed } from '@/lib/summary'

const content = lexicalFromBlocks([
  'Montei um homelab com um mini PC usado pra rodar meus projetos sem pagar nuvem. Foi a melhor decisão do ano.',
  { heading: 'Por que um modelo pequeno' },
  'Resumir texto não precisa de modelo gigante. Um 4B quantizado dá conta e cabe em 3 GB de RAM.',
  { code: 'llama-server -m modelo.gguf', language: 'bash' },
  { code: 'docker compose up -d', language: 'bash' },
  { heading: 'O que eu aprendi' },
  'Fila com um job por vez evita travar o servidor. E dormir quando parado libera a memória.',
])

const good = {
  summary:
    'Montei um homelab com um mini PC usado e rodei um modelo pequeno só em CPU pra resumir os posts. Ficou leve, privado e rápido o bastante, sem GPU e sem mandar nada pra fora.',
  keyPoints: [
    'Um modelo 4B quantizado cabe em 3 GB de RAM.',
    'Fila com um job por vez evita travar o servidor.',
    'Dormir quando parado libera a memória.',
  ],
}

describe('preparo do texto e prompt', () => {
  it('código vira [código] (uma vez só) e o resto vira Markdown', () => {
    const text = postToPromptText(content)
    expect(text).toContain('## Por que um modelo pequeno')
    expect(text).toContain('[código]')
    expect(text).not.toContain('llama-server')
    expect(text.match(/\[código\]/g)).toHaveLength(1)
  })

  it('mensagens e corpo da chamada iguais aos do teste do plano', () => {
    const msgs = singleMessages({ title: 'IA local', subtitle: 'Sem GPU', content }, 'TEXTO')
    expect(msgs[0]).toEqual({ role: 'system', content: SYSTEM_PROMPT })
    expect(msgs[1].content).toBe(
      'Título: IA local\nLinha fina: Sem GPU\n\nResuma este post:\n\nTEXTO',
    )
    expect(SYSTEM_PROMPT).toContain('entre 160 e 400 caracteres')
    expect(SYSTEM_PROMPT).toContain('de 3 a 5 itens')
    const body = chatBody(msgs)
    expect(body).toMatchObject({ temperature: 0.2, max_tokens: 450, stream: false })
    expect(body.response_format).toEqual({
      type: 'json_schema',
      json_schema: { name: 'sintese', schema: SUMMARY_JSON_SCHEMA },
    })
    expect(SUMMARY_JSON_SCHEMA.required).toEqual(['summary', 'keyPoints'])
  })

  it('corta post longo em partes entre parágrafos (map-reduce)', () => {
    const para = 'Uma frase de teste com algumas palavras. '.repeat(20).trim()
    const text = Array.from({ length: 12 }, () => para).join('\n\n')
    const chunks = splitChunks(text, 600)
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.every((c) => estimateTokens(c) <= 600)).toBe(true)
    expect(chunks.join('\n\n')).toBe(text)
    expect(splitChunks('curto', 600)).toEqual(['curto'])
    // parágrafo gigante quebra em frases
    const giant = 'Frase longa de teste aqui. '.repeat(400)
    expect(splitChunks(giant, 300).every((c) => estimateTokens(c) <= 300)).toBe(true)
    const red = reduceMessages({ title: 'T', content: null }, [good, good])
    expect(red[1].content).toContain('Parte 2: Montei')
  })
})

describe('validação da resposta da IA', () => {
  it('aceita JSON bom (até com cerca ```json) e limpa markdown e aspas', () => {
    expect(normalizeSummary(JSON.stringify(good))).toEqual(good)
    const dirty = {
      summary: `**Resumo:** ${good.summary.replace('leve', '“leve”')} 🚀`,
      keyPoints: ['- **Um** ponto com `código`.', '2. Outro ponto bem dito.', '# Mais um ponto.'],
    }
    const r = normalizeSummary('```json\n' + JSON.stringify(dirty) + '\n```')
    expect(r.summary).toContain('"leve"')
    expect(r.summary).not.toMatch(/\*|🚀/)
    expect(r.keyPoints).toEqual(['Um ponto com código.', 'Outro ponto bem dito.', 'Mais um ponto.'])
  })

  it('corta na última frase completa e limita 5 pontos', () => {
    const long = `${good.summary} ${'Mais uma frase que passa do limite do resumo. '.repeat(8)}`
    const r = normalizeSummary({
      summary: long,
      keyPoints: [...good.keyPoints, 'Quarto ponto.', 'Quinto ponto.', 'Sexto ponto.'],
    })
    expect(r.summary.length).toBeLessThanOrEqual(400)
    expect(r.summary.endsWith('.')).toBe(true)
    expect(r.keyPoints).toHaveLength(5)
    expect(cutAtSentence('a'.repeat(50) + ' ' + 'b'.repeat(200), 140).endsWith('…')).toBe(true)
    expect(cutAtSentence('a'.repeat(50) + ' ' + 'b'.repeat(200), 140).length).toBeLessThanOrEqual(
      140,
    )
  })

  it('recusa curto, sem pontos, repetido ou não-JSON', () => {
    expect(() => normalizeSummary('não é json')).toThrow(SummaryValidationError)
    expect(() => normalizeSummary({ summary: 'Curto demais.', keyPoints: good.keyPoints })).toThrow(
      /summary curto \(13 caracteres; mínimo 160\)/,
    )
    expect(() =>
      normalizeSummary({ summary: good.summary, keyPoints: ['Igual.', 'igual.', 'IGUAL.'] }),
    ).toThrow(/só 1 pontos-chave válidos/)
    expect(() => normalizeSummary([1, 2])).toThrow(/esperava um objeto/)
    expect(cleanText('  ## Título   com  espaço ')).toBe('Título com espaço')
  })
})

describe('resumo extrativo (plano B)', () => {
  it('linha fina + primeiro parágrafo e uma frase por seção', () => {
    const r = extractiveSummary({ title: 'Homelab', subtitle: 'Um mini PC resolve', content })
    expect(r.summary.startsWith('Um mini PC resolve. Montei um homelab')).toBe(true)
    expect(r.summary.length).toBeGreaterThanOrEqual(160)
    expect(r.summary.length).toBeLessThanOrEqual(400)
    // primeira frase de cada seção que ainda não está no resumo
    expect(r.keyPoints[0]).toBe('Fila com um job por vez evita travar o servidor.')
    expect(r.keyPoints.every((k) => !r.summary.includes(k))).toBe(true)
    expect(r.keyPoints.length).toBeGreaterThanOrEqual(3)
  })
})

describe('origem da síntese', () => {
  it('IA e extrativo exigem revisão pra publicar; manual não', () => {
    expect(validateSummaryReviewed(false, 'manual')).toBe(true)
    for (const src of ['ia', 'ia-editada', 'extrativo'])
      expect(validateSummaryReviewed(false, src)).toMatch(/revise/)
    expect(validateSummaryReviewed(true, 'extrativo')).toBe(true)
  })
})

/* ------------------------- cliente (fetch falso) ------------------------- */

type Call = { url: string; body: ReturnType<typeof chatBody> }

function fakeFetch(responses: (Response | Error | ((c: Call) => Response))[]) {
  const calls: Call[] = []
  const impl = (async (url: string, init: RequestInit) => {
    const call = { url, body: JSON.parse(String(init.body)) }
    calls.push(call)
    const r = responses.shift()
    if (!r) throw new Error('sem resposta')
    if (r instanceof Error) throw r
    return typeof r === 'function' ? r(call) : r
  }) as unknown as typeof fetch
  return { impl, calls }
}

const ok = (content: unknown, model = '/models/Qwen3-4B-Instruct-2507-Q3_K_M.gguf') =>
  Response.json({
    model,
    choices: [
      { message: { content: typeof content === 'string' ? content : JSON.stringify(content) } },
    ],
    usage: { prompt_tokens: 1639, completion_tokens: 234 },
  })

const cfg = { ...llmConfig({}), timeoutMs: 2000 }

describe('cliente do llama.cpp', () => {
  it('configuração padrão do plano e nome curto do modelo', () => {
    expect(llmConfig({})).toMatchObject({
      baseUrl: 'http://llm:8080/v1',
      modelFile: 'Qwen3-4B-Instruct-2507-Q3_K_M.gguf',
      timeoutMs: 360000,
      maxInputTokens: 3800,
      attempts: 2,
    })
    expect(llmConfig({ LLM_BASE_URL: 'http://x:1/v1/', LLM_TIMEOUT_MS: 'abc' })).toMatchObject({
      baseUrl: 'http://x:1/v1',
      timeoutMs: 360000,
    })
    expect(modelName('/models/gemma-3-1b-it-Q4_K_M.gguf')).toBe('gemma-3-1b-it-Q4_K_M')
  })

  it('uma chamada, resposta validada, modelo e tokens contados', async () => {
    const f = fakeFetch([ok(good)])
    const out = await generatePostSummary({ title: 'T', content }, cfg, f.impl)
    expect(f.calls).toHaveLength(1)
    expect(f.calls[0].url).toBe('http://llm:8080/v1/chat/completions')
    expect(f.calls[0].body.response_format.type).toBe('json_schema')
    expect(out).toMatchObject({
      ...good,
      model: 'Qwen3-4B-Instruct-2507-Q3_K_M',
      chunks: 1,
      calls: 1,
      promptTokens: 1639,
      completionTokens: 234,
    })
  })

  it('tenta de novo uma vez (500 e depois resposta inválida → ok)', async () => {
    const f = fakeFetch([new Response('ocupado', { status: 503 }), ok(good)])
    expect((await generatePostSummary({ title: 'T', content }, cfg, f.impl)).calls).toBe(2)
    const g = fakeFetch([ok({ summary: 'x', keyPoints: [] }), ok(good)])
    expect((await generatePostSummary({ title: 'T', content }, cfg, g.impl)).summary).toBe(
      good.summary,
    )
  })

  it('falha duas vezes → erro em pt-BR (rede, status e formato)', async () => {
    const down = fakeFetch([new TypeError('fetch failed'), new TypeError('fetch failed')])
    await expect(generatePostSummary({ title: 'T', content }, cfg, down.impl)).rejects.toThrow(
      'não deu pra falar com a IA (http://llm:8080/v1)',
    )
    const err = fakeFetch([
      new Response('x', { status: 500 }),
      Response.json({ error: { message: 'falha simulada' } }, { status: 500 }),
    ])
    await expect(generatePostSummary({ title: 'T', content }, cfg, err.impl)).rejects.toThrow(
      'a IA respondeu 500: falha simulada',
    )
    const bad = fakeFetch([ok('{}'), ok('{}')])
    await expect(generatePostSummary({ title: 'T', content }, cfg, bad.impl)).rejects.toThrow(
      SummaryValidationError,
    )
  })

  it('timeout vira mensagem clara', async () => {
    const slow = (async (_u: string, init: RequestInit) =>
      new Promise((_r, rej) =>
        init.signal?.addEventListener('abort', () => rej(init.signal?.reason)),
      )) as unknown as typeof fetch
    await expect(
      generatePostSummary({ title: 'T', content }, { ...cfg, timeoutMs: 50 }, slow),
    ).rejects.toThrow('a IA não respondeu em 0 s')
  })

  it('post sem texto não chama a IA', async () => {
    const f = fakeFetch([])
    await expect(
      generatePostSummary({ title: 'T', content: lexicalFromBlocks(['Oi.']) }, cfg, f.impl),
    ).rejects.toThrow(LlmError)
    expect(f.calls).toHaveLength(0)
  })

  it('post longo: resume por partes e junta no fim', async () => {
    const big = lexicalFromBlocks(
      Array.from(
        { length: 40 },
        (_, i) => `Parágrafo ${i} ${'com bastante texto pra encher. '.repeat(12)}`,
      ),
    )
    const n = splitChunks(postToPromptText(big), 1000).length
    expect(n).toBeGreaterThan(2)
    const f = fakeFetch(Array.from({ length: n + 1 }, () => ok(good)))
    const out = await generatePostSummary(
      { title: 'Longo', content: big },
      { ...cfg, maxInputTokens: 1000 },
      f.impl,
    )
    expect(out.chunks).toBe(n)
    expect(f.calls).toHaveLength(n + 1)
    expect(f.calls[0].body.messages[1].content).toContain(
      `dividido em ${n} partes. Resuma só a parte 1`,
    )
    expect(f.calls[n].body.messages[1].content).toContain('Junte tudo num resumo só')
  })
})
