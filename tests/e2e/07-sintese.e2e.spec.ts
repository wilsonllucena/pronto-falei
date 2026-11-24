import { expect, type Page, test } from '@playwright/test'

import { lexicalFromBlocks } from '../../src/lib/lexicalBuilder'

/**
 * Passo 8: botão "Gerar síntese com IA" no admin, job generateSummary,
 * validação e resumo extrativo. Com E2E_LLM=mock (CI), o compose sobe o
 * mock do llama.cpp (perfil `mock`); com E2E_LLM=real, gera de verdade com o
 * modelo local (perfil `ia`) num post do seed.
 */
const email = process.env.E2E_EMAIL
const password = process.env.E2E_PASSWORD
const shotsDir = process.env.SHOTS_DIR
const LLM = process.env.E2E_LLM
const run = Date.now().toString(36)
const DESKTOP = { width: 1440, height: 1100 }

test.describe.configure({ mode: 'serial' })

const shot = async (page: Page, name: string) => {
  if (shotsDir) await page.screenshot({ path: `${shotsDir}/${name}.png` })
}

async function login(page: Page) {
  await page.goto('/admin/login')
  await expect(page.locator('#field-email')).toBeVisible()
  await page.waitForLoadState('networkidle')
  await page.fill('#field-email', email!)
  await page.fill('#field-password', password!)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/\/admin\/?$/, { timeout: 30_000 })
}

const content = lexicalFromBlocks([
  'Montei um homelab com um mini PC usado pra rodar meus projetos sem pagar nuvem. Foi a melhor decisão do ano, e conto aqui o porquê.',
  { heading: 'Por que um modelo pequeno' },
  'Resumir texto não precisa de modelo gigante. Um 4B quantizado dá conta e cabe em 3 GB de RAM.',
  { code: 'llama-server -m modelo.gguf --sleep-idle-seconds 120', language: 'bash' },
  { heading: 'O que eu aprendi' },
  'Fila com um job por vez evita travar o servidor. E dormir quando parado libera a memória pros outros apps.',
])

async function draftPost(page: Page, title: string) {
  const res = await page.request.post('/api/posts?draft=true', {
    data: { title: `${title} ${run}`, subtitle: 'Um mini PC resolve', _status: 'draft', content },
    headers: { Origin: new URL(page.url()).origin },
  })
  expect(res.status(), await res.text()).toBe(201)
  return String((await res.json()).doc.id)
}

async function openSummaryTab(page: Page, id: string) {
  await page.goto(`/admin/collections/posts/${id}`)
  await expect(page.locator('#field-title').first()).toBeVisible({ timeout: 30_000 })
  await page.waitForLoadState('networkidle')
  // o live preview (aberto no teste do passo 5) ocupa a tela; fecha pra focar no formulário
  const live = page.locator('#live-preview-toggler.live-preview-toggler--active')
  if (await live.isVisible()) await live.click()
  await page
    .getByRole('tab', { name: 'Síntese' })
    .or(page.locator('button', { hasText: 'Síntese' }))
    .first()
    .click()
  await expect(page.locator('.pf-ai__button')).toBeVisible()
}

/** GET autenticado (o Payload só aceita o cookie com Origin da mesma origem). */
const get = (page: Page, url: string) =>
  page.request.get(url, { headers: { Origin: new URL(page.url()).origin } })

/** Valores dos pontos-chave no formulário (espera as linhas novas renderizarem). */
async function keyPointValues(page: Page) {
  const inputs = page.locator('#field-keyPoints input[id^="field-keyPoints__"][id$="__text"]')
  await expect.poll(() => inputs.count(), { timeout: 15_000 }).toBeGreaterThanOrEqual(3)
  return inputs.evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value))
}

test.beforeEach(async ({ page }) => {
  test.skip(!email || !password, 'defina E2E_EMAIL e E2E_PASSWORD')
  test.skip(!LLM, 'defina E2E_LLM=mock (CI) ou E2E_LLM=real (modelo local)')
  await page.setViewportSize(DESKTOP)
  await login(page)
})

test.describe('com o mock do llm', () => {
  test.skip(() => LLM !== 'mock', 'só com E2E_LLM=mock')

  test('endpoint: só logado, 404 e job repetido descartado', async ({ page, request }) => {
    const id = await draftPost(page, '[llm-lento] Fila')
    expect((await request.post(`/api/posts/${id}/generate-summary`)).status()).toBe(401)
    expect((await request.get(`/api/posts/${id}/summary-status`)).status()).toBe(401)
    const origin = { Origin: new URL(page.url()).origin }
    const missing = await page.request.post(
      '/api/posts/000000000000000000000000/generate-summary',
      {
        headers: origin,
      },
    )
    expect(missing.status()).toBe(404)

    const a = await page.request.post(`/api/posts/${id}/generate-summary`, { headers: origin })
    expect(a.status()).toBe(202)
    const b = await page.request.post(`/api/posts/${id}/generate-summary`, { headers: origin })
    expect(b.status()).toBe(202)
    const [ja, jb] = [await a.json(), await b.json()]
    expect(ja.reused).toBe(false)
    expect(jb).toMatchObject({ jobId: ja.jobId, reused: true })
    await expect
      .poll(
        async () => (await (await get(page, `/api/posts/${id}/summary-status`)).json()).status,
        {
          timeout: 30_000,
        },
      )
      .toBe('done')
  })

  test('gera a síntese, preenche o formulário e exige revisão pra publicar', async ({ page }) => {
    const id = await draftPost(page, 'Post da IA')
    await openSummaryTab(page, id)
    await expect(page.locator('#field-summary')).toHaveValue('')
    await shot(page, 'p8-01-botao-gerar-sintese')

    await page.locator('.pf-ai__button').click()
    await expect(page.locator('.pf-ai__status')).toContainText('Gerando com a IA local')
    await shot(page, 'p8-02-gerando')

    await expect(page.locator('.pf-ai__status--ok')).toContainText('Síntese gerada por mock-llm', {
      timeout: 30_000,
    })
    const summary = await page.locator('#field-summary').inputValue()
    expect(summary.startsWith(`Neste post eu falo sobre Post da IA ${run}.`)).toBe(true)
    expect(summary.length).toBeGreaterThanOrEqual(160)
    const points = await keyPointValues(page)
    expect(points.length).toBeGreaterThanOrEqual(3)
    expect(points[0]).toBe('Explico por que um modelo pequeno.')
    await expect(page.locator('#field-summarySource')).toContainText('IA')
    await expect(page.locator('#field-summaryModel')).toHaveValue('mock-llm')
    await expect(page.locator('#field-summaryReviewed')).not.toBeChecked()
    await shot(page, 'p8-03-sintese-gerada')

    // o job grava no rascunho; o autosave mantém o que está no formulário
    await expect
      .poll(
        async () => {
          const d = await (await get(page, `/api/posts/${id}?draft=true&depth=0`)).json()
          return [d.summarySource, d.summaryModel, d.summary === summary, d.keyPoints?.length]
        },
        { timeout: 20_000 },
      )
      .toEqual(['ia', 'mock-llm', true, points.length])

    // publicar sem revisar é recusado
    await expect(async () => {
      await page.click('#action-save')
      await expect(page.getByText('A síntese veio da IA: revise').first()).toBeVisible({
        timeout: 4_000,
      })
    }).toPass({ timeout: 45_000 })
    await page.locator('#field-summaryReviewed').scrollIntoViewIfNeeded()
    await shot(page, 'p8-04-publicar-sem-revisao')

    await page.locator('#field-summaryReviewed').check()
    await expect(async () => {
      await page.click('#action-save')
      await expect
        .poll(async () => (await (await get(page, `/api/posts/${id}?depth=0`)).json())._status, {
          timeout: 5_000,
        })
        .toBe('published')
    }).toPass({ timeout: 45_000 })
    const live = await (await get(page, `/api/posts/${id}?depth=0`)).json()
    expect(live).toMatchObject({ summary, summarySource: 'ia', summaryReviewed: true })
    expect(Date.parse(live.summaryGeneratedAt)).not.toBeNaN()
    await page.request.delete(`/api/posts/${id}`, {
      headers: { Origin: new URL(page.url()).origin },
    })
  })

  test('IA com erro: mensagem clara e resumo extrativo', async ({ page }) => {
    const id = await draftPost(page, '[llm-erro] Falha')
    await openSummaryTab(page, id)
    await page.locator('.pf-ai__button').click()
    const box = page.locator('.pf-ai__status--error')
    await expect(box).toContainText(
      'A IA não conseguiu gerar a síntese: a IA respondeu 500: falha simulada do mock',
      {
        timeout: 30_000,
      },
    )
    await expect(page.locator('.pf-ai__fallback')).toBeVisible()
    await shot(page, 'p8-05-erro-da-ia')

    await page.locator('.pf-ai__fallback').click()
    await expect(page.locator('.pf-ai__status')).toContainText('Resumo extrativo aplicado')
    expect(
      (await page.locator('#field-summary').inputValue()).startsWith(
        'Um mini PC resolve. Montei um homelab',
      ),
    ).toBe(true)
    expect((await keyPointValues(page)).length).toBeGreaterThanOrEqual(3)
    await expect(page.locator('#field-summarySource')).toContainText('Extrativo')
    await shot(page, 'p8-06-resumo-extrativo')
  })

  test('resposta fora das regras é recusada pela validação', async ({ page }) => {
    const id = await draftPost(page, '[llm-invalido] Curto')
    await openSummaryTab(page, id)
    await page.locator('.pf-ai__button').click()
    await expect(page.locator('.pf-ai__status--error')).toContainText(
      'fora do formato: summary curto (13 caracteres; mínimo 160)',
      { timeout: 30_000 },
    )
    await expect(page.locator('#field-summary')).toHaveValue('')
    await shot(page, 'p8-07-validacao-recusada')
  })

  test('admin no tema escuro', async ({ page }) => {
    const id = await draftPost(page, 'Post no escuro')
    await page
      .context()
      .addCookies([{ name: 'payload-theme', value: 'dark', url: new URL(page.url()).origin }])
    await openSummaryTab(page, id)
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await page.locator('.pf-ai__button').click()
    await expect(page.locator('.pf-ai__status--ok')).toBeVisible({ timeout: 30_000 })
    await keyPointValues(page)
    await shot(page, 'p8-09-sintese-gerada-escuro')
    await page.context().clearCookies({ name: 'payload-theme' })
  })

  test.describe('mobile', () => {
    test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
    test('botão e resultado no celular', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 })
      const id = await draftPost(page, 'Post no celular')
      await openSummaryTab(page, id)
      await page.locator('.pf-ai__button').click()
      await expect(page.locator('.pf-ai__status--ok')).toBeVisible({ timeout: 30_000 })
      await page.locator('.pf-ai').scrollIntoViewIfNeeded()
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      )
      expect(overflow).toBeLessThanOrEqual(0)
      await shot(page, 'p8-08-sintese-gerada-mobile')
    })
  })
})

test.describe('com o modelo real', () => {
  test.skip(() => LLM !== 'real', 'só com E2E_LLM=real')
  test.setTimeout(900_000)

  test('gera a síntese de um post do seed com a IA local', async ({ page }) => {
    const slug = process.env.E2E_REAL_SLUG || 'ia-local-no-homelab-sem-gpu'
    const found = await (
      await get(page, `/api/posts?where[slug][equals]=${slug}&depth=0&draft=true`)
    ).json()
    const id = String(found.docs[0].id)
    await openSummaryTab(page, id)
    const before = await page.locator('#field-summary').inputValue()
    await page.locator('.pf-ai__button').click()
    await expect(page.locator('.pf-ai__status')).toContainText('Gerando com a IA local')
    await page.waitForTimeout(8000)
    await shot(page, 'p8-10-gerando-modelo-real')
    await expect(page.locator('.pf-ai__status--ok')).toContainText('Síntese gerada por', {
      timeout: 840_000,
    })
    const summary = await page.locator('#field-summary').inputValue()
    expect(summary).not.toBe(before)
    expect(summary.length).toBeGreaterThanOrEqual(160)
    expect(summary.length).toBeLessThanOrEqual(400)
    expect((await keyPointValues(page)).length).toBeGreaterThanOrEqual(3)
    await expect(page.locator('#field-summaryModel')).toHaveValue(
      /Qwen3-4B-Instruct-2507-Q3_K_M|gemma/,
    )
    await page.locator('.pf-ai').scrollIntoViewIfNeeded()
    await shot(page, 'p8-11-sintese-gerada-modelo-real')
    const status = await (await get(page, `/api/posts/${id}/summary-status`)).json()
    console.log(`[real] ${JSON.stringify(status)}`)
  })
})
