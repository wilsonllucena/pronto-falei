// Mock do llama.cpp server pro CI e pros testes: mesma API
// (/health e /v1/chat/completions com response_format json_schema), sem
// modelo. Gera uma síntese determinística a partir do texto recebido.
// Gatilhos no título do post: [llm-erro] → 500, [llm-invalido] → JSON fora
// das regras (summary curto), [llm-lento] → demora 8 s.
import http from 'node:http'

const PORT = Number(process.env.PORT || 8080)
const DELAY = Number(process.env.MOCK_DELAY_MS || 1500)
const MODEL = process.env.MOCK_MODEL || 'mock-llm.gguf'
let calls = 0

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const send = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

function summarize(user) {
  const title = (user.match(/^Título: (.+)$/m) || [, 'o post'])[1].trim()
  const body = user.split(/\n\n/).slice(2).join('\n\n')
  const sentences = (body.replace(/^#+ .*$/gm, '').match(/[^.!?\n]{25,}[.!?]/g) || []).map((s) =>
    s.replace(/[*_`[\]#>]/g, '').trim(),
  )
  let summary = `Neste post eu falo sobre ${title.replace(/\.$/, '')}.`
  for (const s of sentences) {
    if (summary.length >= 200) break
    if ((summary + ' ' + s).length <= 380) summary += ' ' + s
  }
  while (summary.length < 170) summary += ' Escrevi do jeito mais direto possível.'
  const heads = [...body.matchAll(/^#{2,3} (.+)$/gm)].map((m) => m[1].trim())
  const points = [...heads.map((h) => `Explico ${h.charAt(0).toLowerCase()}${h.slice(1)}.`)]
  for (const s of sentences.slice(3)) if (points.length < 3) points.push(s.slice(0, 130))
  while (points.length < 3) points.push(`Ponto ${points.length + 1} sobre ${title}.`.slice(0, 130))
  return { summary, keyPoints: points.slice(0, 5) }
}

http
  .createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/health') return send(res, 200, { status: 'ok' })
    if (req.method === 'GET' && req.url === '/calls') return send(res, 200, { calls })
    if (req.method !== 'POST' || req.url !== '/v1/chat/completions') {
      return send(res, 404, { error: { message: 'not found' } })
    }
    let raw = ''
    for await (const c of req) raw += c
    let body
    try {
      body = JSON.parse(raw)
    } catch {
      return send(res, 400, { error: { message: 'invalid json' } })
    }
    calls++
    if (
      body?.response_format?.type !== 'json_schema' ||
      !body.response_format.json_schema?.schema
    ) {
      return send(res, 400, { error: { message: 'response_format json_schema obrigatório' } })
    }
    const user = (body.messages || []).find((m) => m.role === 'user')?.content || ''
    const title = (user.match(/^Título: (.+)$/m) || [, ''])[1]
    await sleep(title.includes('[llm-lento]') ? 8000 : DELAY)
    if (title.includes('[llm-erro]')) {
      return send(res, 500, { error: { message: 'falha simulada do mock' } })
    }
    const content = title.includes('[llm-invalido]')
      ? JSON.stringify({ summary: 'Curto demais.', keyPoints: ['Um'] })
      : JSON.stringify(summarize(user))
    send(res, 200, {
      id: `mock-${calls}`,
      object: 'chat.completion',
      model: MODEL,
      choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content } }],
      usage: {
        prompt_tokens: Math.ceil(user.length / 3.8),
        completion_tokens: Math.ceil(content.length / 3.8),
      },
    })
  })
  .listen(PORT, '0.0.0.0', () => console.log(`llm-mock ouvindo na porta ${PORT}`))
