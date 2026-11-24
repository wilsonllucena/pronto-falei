import { expect, type Page, test } from '@playwright/test'

/**
 * Comentários (passo 12): Remark42 servido pelo próprio domínio em
 * /comentarios/*, widget com lazy-load que segue o tema do site, login
 * anônimo e moderação pelo admin do blog. Precisa da stack com o perfil
 * `comentarios`, REMARK_SITE_ID no .env do app e E2E_COMMENTS=1.
 */
const enabled = process.env.E2E_COMMENTS === '1'
const email = process.env.E2E_EMAIL
const password = process.env.E2E_PASSWORD
const shotsDir = process.env.SHOTS_DIR
const POST = '/posts/ia-local-no-homelab-sem-gpu'
const TEXT = `Comentário de teste ${Date.now()}: ótimo post!`

test.skip(!enabled, 'defina E2E_COMMENTS=1 (stack com o perfil comentarios)')
test.describe.configure({ mode: 'serial' })

const frame = (page: Page) => page.frameLocator('#remark42 iframe')

async function openComments(page: Page) {
  await page.locator('#comentarios').scrollIntoViewIfNeeded()
  await expect(frame(page).locator('textarea')).toBeVisible({ timeout: 20_000 })
}

test('widget só carrega perto da seção (lazy-load) e pelo próprio domínio', async ({
  page,
  baseURL,
}) => {
  const remark: string[] = []
  page.on('request', (r) => {
    if (r.url().includes('/comentarios/')) remark.push(r.url())
  })
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(POST)
  await expect(page.getByRole('heading', { name: 'Comentários' })).toBeAttached()
  await page.waitForTimeout(1000)
  expect(remark).toEqual([])

  await openComments(page)
  expect(remark.some((u) => u.endsWith('/comentarios/web/embed.mjs'))).toBe(true)
  // tudo pelo próprio domínio (sem hostname novo)
  for (const u of remark) expect(new URL(u).origin).toBe(new URL(baseURL!).origin)
  const src = await page.locator('#remark42 iframe').getAttribute('src')
  expect(src).toContain('locale=bp')
  expect(src).toContain('site_id=pronto-falei')
})

test('segue o tema claro/escuro do site', async ({ page }) => {
  await page.goto(POST)
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
  await openComments(page)
  const root = frame(page).locator('#remark42 > div').first()
  await expect(root).toHaveClass(/\bdark\b/)
  if (shotsDir) {
    await page.locator('#comentarios').screenshot({ path: `${shotsDir}/p12-02-widget-escuro.png` })
  }
  await page.locator('.theme-toggle').click()
  await expect(root).toHaveClass(/\blight\b/)
  if (shotsDir) {
    await page.locator('#comentarios').screenshot({ path: `${shotsDir}/p12-01-widget-claro.png` })
  }
})

test('visitante comenta só com um nome (anônimo), sem cadastro', async ({ page }) => {
  await page.goto(POST)
  await openComments(page)
  const f = frame(page)
  await f.getByRole('button', { name: 'Entrar' }).click()
  await f.locator('input[name="username"]').fill('Leitora E2E')
  await f.locator('input[name="username"]').press('Enter')
  await expect(f.getByRole('button', { name: 'Entrar' })).toHaveCount(0)
  await f.locator('textarea').fill(TEXT)
  await f.locator('form[aria-label="Novo comentário"] button[type="submit"]').click()
  await expect(f.getByText(TEXT)).toBeVisible({ timeout: 15_000 })
  // só cookies do Remark42 (JWT/XSRF) além dos do site
  const names = (await page.context().cookies()).map((c) => c.name)
  expect(names).toContain('JWT')
  if (shotsDir) {
    await page
      .locator('#comentarios')
      .screenshot({ path: `${shotsDir}/p12-03-comentario-anonimo.png` })
  }
})

test('API de admin do Remark42 não fica exposta pelo domínio', async ({ request }) => {
  const res = await request.get('/comentarios/api/v1/admin/blocked?site=pronto-falei', {
    headers: { Authorization: `Basic ${Buffer.from('admin:qualquer').toString('base64')}` },
  })
  expect(res.status()).toBe(401)
})

test('moderação no admin do blog: exige login, lista e apaga', async ({ page, request }) => {
  test.skip(!email || !password, 'defina E2E_EMAIL e E2E_PASSWORD')
  const anon = await request.get('/api/comentarios/recentes')
  expect(anon.status()).toBe(401)
  const anonPost = await request.post('/api/comentarios/moderar', {
    data: { action: 'bloquear', userId: 'anonymous_x' },
  })
  expect([401, 403]).toContain(anonPost.status())

  const login = await page.request.post('/api/users/login', { data: { email, password } })
  expect(login.ok()).toBe(true)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/admin/comentarios')
  await expect(page.getByRole('heading', { name: 'Comentários', level: 1 })).toBeVisible()
  const item = page.locator('.moderation__item', { hasText: TEXT })
  await expect(item).toBeVisible({ timeout: 15_000 })
  await expect(item).toContainText('Leitora E2E')
  await expect(page.locator('nav a.comentarios-nav-link')).toBeVisible()
  if (shotsDir) await page.screenshot({ path: `${shotsDir}/p12-04-admin-moderacao.png` })

  page.once('dialog', (d) => d.accept())
  await item.getByRole('button', { name: 'Apagar' }).click()
  await expect(item).toHaveCount(0, { timeout: 15_000 })

  // sumiu do post
  await page.goto(POST)
  await openComments(page)
  await expect(frame(page).getByText(TEXT)).toHaveCount(0)
})

test('anti-spam: palavra proibida é recusada; bloquear e desbloquear autor', async ({
  page,
  baseURL,
}) => {
  test.skip(!email || !password, 'defina E2E_EMAIL e E2E_PASSWORD')
  test.setTimeout(90_000)
  const api = page.request
  const login = await api.get(
    '/comentarios/auth/anonymous/login?user=Spammer%20E2E&aud=pronto-falei&site=pronto-falei',
  )
  expect(login.ok()).toBe(true)
  const xsrf = (await page.context().cookies()).find((c) => c.name === 'XSRF-TOKEN')!.value
  const post = (text: string) =>
    api.post('/comentarios/api/v1/comment?site=pronto-falei', {
      headers: { 'X-XSRF-TOKEN': xsrf },
      data: { text, locator: { site: 'pronto-falei', url: `${baseURL}${POST}` } },
    })
  // o Remark42 limita a frequência de envio por IP (429): espera e tenta de novo
  const send = async (text: string) => {
    for (let i = 0; i < 6; i++) {
      const res = await post(text)
      if (res.status() !== 429) return res.status()
      await page.waitForTimeout(6_000)
    }
    return 429
  }
  expect(await send('ganhe dinheiro no cassino agora')).toBe(400)
  const spamText = `Spam leve ${Date.now()}`
  expect(await send(spamText)).toBe(201)

  const admin = await api.post('/api/users/login', { data: { email, password } })
  expect(admin.ok()).toBe(true)
  await page.goto('/admin/comentarios')
  const item = page.locator('.moderation__item', { hasText: spamText })
  await expect(item).toBeVisible({ timeout: 15_000 })
  page.once('dialog', (d) => d.accept())
  await item.getByRole('button', { name: 'Bloquear autor' }).click()
  const blocked = page.locator('[data-blocked-id]', { hasText: 'Spammer E2E' })
  await expect(blocked).toBeVisible({ timeout: 15_000 })
  // bloqueio permanente some com os comentários do autor
  await expect(item).toHaveCount(0)
  if (shotsDir) await page.screenshot({ path: `${shotsDir}/p12-05-admin-bloqueado.png` })
  page.once('dialog', (d) => d.accept())
  await blocked.getByRole('button', { name: 'Desbloquear' }).click()
  await expect(blocked).toHaveCount(0, { timeout: 15_000 })
})
