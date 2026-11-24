import { type APIRequestContext, expect, request as pwRequest, test } from '@playwright/test'

/**
 * Newsletter (passo 13): Listmonk atrás do próprio domínio. Formulário do blog
 * com confirmação dupla, páginas de confirmar/sair em /newsletter/subscription/*
 * e painel/API do Listmonk fora do domínio. Precisa da stack com o perfil
 * `newsletter` (Listmonk + Mailpit), do scripts/setup-listmonk.py e de
 * E2E_NEWSLETTER=1, E2E_MAILPIT_URL e E2E_LISTMONK_URL (+ usuário/senha do
 * painel de dev em E2E_LISTMONK_USER / E2E_LISTMONK_PASSWORD).
 */
const enabled = process.env.E2E_NEWSLETTER === '1'
const mailpit = process.env.E2E_MAILPIT_URL ?? 'http://127.0.0.1:3134'
const listmonkUrl = process.env.E2E_LISTMONK_URL ?? 'http://127.0.0.1:3135'
const lmUser = process.env.E2E_LISTMONK_USER ?? 'admin'
const lmPass = process.env.E2E_LISTMONK_PASSWORD ?? 'listmonk-dev-admin'
const shotsDir = process.env.SHOTS_DIR
const EMAIL = `leitora-${Date.now()}@exemplo.test`

test.skip(!enabled, 'defina E2E_NEWSLETTER=1 (stack com o perfil newsletter)')
test.describe.configure({ mode: 'serial' })

type MailSummary = { ID: string; Subject: string; To: { Address: string }[] }

async function waitMail(request: APIRequestContext, to: string, subject: RegExp) {
  let found: MailSummary | undefined
  await expect
    .poll(
      async () => {
        const res = await request.get(`${mailpit}/api/v1/messages?limit=200`)
        const list = ((await res.json()).messages ?? []) as MailSummary[]
        found = list.find((m) => m.To.some((t) => t.Address === to) && subject.test(m.Subject))
        return Boolean(found)
      },
      { timeout: 90_000, intervals: [1_000, 2_000, 3_000] },
    )
    .toBe(true)
  const full = await (await request.get(`${mailpit}/api/v1/message/${found!.ID}`)).json()
  return full as { HTML: string; Text: string; Subject: string; From: { Address: string } }
}

const links = (html: string) =>
  [...html.matchAll(/https?:\/\/[^"'\s<>]+/g)].map((m) => m[0].replace(/&amp;/g, '&'))

async function listmonk() {
  const ctx = await pwRequest.newContext({ baseURL: listmonkUrl })
  const page = await (await ctx.get('/admin/login')).text()
  const nonce = page.match(/name="nonce" value="([^"]+)"/)?.[1] ?? ''
  const res = await ctx.post('/admin/login', {
    form: { nonce, next: '/admin', username: lmUser, password: lmPass },
  })
  expect(res.ok()).toBe(true)
  return ctx
}

test('formulário no blog: página /newsletter e chamada no fim do post', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  const res = await page.goto('/newsletter')
  expect(res?.status()).toBe(200)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('no seu e-mail')
  await expect(page.getByLabel('Seu e-mail')).toBeVisible()
  if (shotsDir) await page.screenshot({ path: `${shotsDir}/p13-01-pagina-newsletter.png` })

  await page.goto('/posts/ia-local-no-homelab-sem-gpu')
  const box = page.locator('#newsletter')
  await expect(box.getByRole('heading', { name: 'Assine a newsletter' })).toBeVisible()
  await box.scrollIntoViewIfNeeded()
  if (shotsDir) await box.screenshot({ path: `${shotsDir}/p13-02-box-no-post.png` })
})

test('inscrição com confirmação dupla, pelo próprio domínio', async ({
  page,
  baseURL,
  request,
}) => {
  await page.goto('/newsletter')
  await page.getByLabel('Seu e-mail').fill(EMAIL)
  await page.getByRole('button', { name: 'Assinar' }).click()
  await expect(page.getByRole('status')).toContainText('Mandamos um e-mail de confirmação')
  if (shotsDir) await page.screenshot({ path: `${shotsDir}/p13-03-inscricao-enviada.png` })

  const mail = await waitMail(request, EMAIL, /Confirmar/)
  const optin = links(mail.HTML).find((u) => u.includes('/subscription/optin/'))
  expect(optin, 'link de confirmação no e-mail').toBeTruthy()
  const url = new URL(optin!)
  expect(url.origin).toBe(new URL(baseURL!).origin)
  expect(url.pathname).toMatch(/^\/newsletter\/subscription\/optin\//)

  await page.goto(`${url.pathname}${url.search}`)
  await expect(page.locator('h2')).toHaveText('Confirmar')
  // visual do blog (CSS do Listmonk + custom.css servidos pelo domínio)
  await expect(page.locator('link[href^="/public/custom.css"]')).toHaveCount(1)
  if (shotsDir) await page.screenshot({ path: `${shotsDir}/p13-04-confirmar.png` })
  await page.getByRole('button', { name: /Confirmar/ }).click()
  await expect(page.locator('h2')).toHaveText('Confirmado')
  if (shotsDir) await page.screenshot({ path: `${shotsDir}/p13-05-confirmado.png` })

  const lm = await listmonk()
  const subs = await lm.get(
    `/api/subscribers?per_page=10&query=${encodeURIComponent(`subscribers.email='${EMAIL}'`)}`,
  )
  const sub = (await subs.json()).data.results[0]
  expect(sub.lists[0].subscription_status).toBe('confirmed')
  await lm.dispose()
})

test('descadastro com um clique pelo link da edição', async ({ page, baseURL, request }) => {
  test.setTimeout(150_000)
  const lm = await listmonk()
  const lists = (await (await lm.get('/api/lists?per_page=all')).json()).data.results
  const list = lists.find((l: { name: string }) => l.name === 'Pronto, Falei!')
  expect(list).toBeTruthy()
  const created = await lm.post('/api/campaigns', {
    data: {
      name: `E2E ${Date.now()}`,
      subject: 'Texto novo no Pronto, Falei! (teste)',
      lists: [list.id],
      content_type: 'richtext',
      body: '<p>Edição de teste do E2E.</p>',
      type: 'regular',
    },
  })
  expect(created.ok()).toBe(true)
  const campaign = (await created.json()).data
  const started = await lm.put(`/api/campaigns/${campaign.id}/status`, {
    data: { status: 'running' },
  })
  expect(started.ok()).toBe(true)

  const mail = await waitMail(request, EMAIL, /Texto novo/)
  const unsub = links(mail.HTML).find((u) =>
    /\/newsletter\/subscription\/[0-9a-f-]{36}\/[0-9a-f-]{36}/.test(u),
  )
  expect(unsub, 'link de descadastro na edição').toBeTruthy()
  const url = new URL(unsub!)
  expect(url.origin).toBe(new URL(baseURL!).origin)
  await page.goto(`${url.pathname}${url.search}`)
  if (shotsDir) await page.screenshot({ path: `${shotsDir}/p13-06-descadastrar.png` })
  await page.locator('#btn-unsub').click()
  await expect(page.locator('h2')).toContainText(/cancelad|Descadastrad/i)
  if (shotsDir) await page.screenshot({ path: `${shotsDir}/p13-07-descadastrado.png` })

  const subs = await lm.get(
    `/api/subscribers?per_page=10&query=${encodeURIComponent(`subscribers.email='${EMAIL}'`)}`,
  )
  const sub = (await subs.json()).data.results[0]
  expect(sub.lists[0].subscription_status).toBe('unsubscribed')
  await lm.dispose()
})

test('anti-abuso: e-mail inválido, isca e limite por IP', async ({ playwright, baseURL }) => {
  const api = await playwright.request.newContext({
    baseURL,
    extraHTTPHeaders: { 'X-Forwarded-For': '198.51.100.23' },
  })
  const bad = await api.post('/api/newsletter/inscrever', { data: { email: 'nao-e-email' } })
  expect(bad.status()).toBe(400)
  const trap = await api.post('/api/newsletter/inscrever', {
    data: { email: 'robo@exemplo.test', website: 'http://spam.example' },
  })
  expect(trap.status()).toBe(200)
  const statuses: number[] = []
  for (let i = 0; i < 5; i++) {
    const r = await api.post('/api/newsletter/inscrever', { data: { email: `x${i}@` } })
    statuses.push(r.status())
  }
  expect(statuses).toContain(429)
  await api.dispose()
})

test('painel e API do Listmonk não ficam expostos pelo domínio', async ({ request }) => {
  for (const p of [
    '/newsletter/admin',
    '/newsletter/api/lists',
    '/newsletter/api/public/subscription',
  ])
    expect((await request.get(p)).status(), p).toBe(404)
  const form = await request.get('/newsletter/subscription/form', { maxRedirects: 0 })
  expect(form.status()).toBe(307)
  expect(form.headers()['location']).toMatch(/\/newsletter$/)
})
