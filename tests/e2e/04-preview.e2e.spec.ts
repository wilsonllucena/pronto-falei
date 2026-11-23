import { expect, type Page, test } from '@playwright/test'

/**
 * Passo 5: pré-visualização do rascunho, live preview no admin e ISR sob
 * demanda (publicar invalida o cache na hora). Precisa do usuário do 01-smoke.
 */
const email = process.env.E2E_EMAIL
const password = process.env.E2E_PASSWORD
const shotsDir = process.env.SHOTS_DIR
const SLUG = 'payload-cms-mongodb-minio-docker'
const TITLE = 'Payload, MongoDB e MinIO num compose só'
const run = Date.now().toString(36)

test.describe.configure({ mode: 'serial' })

async function login(page: Page) {
  await page.goto('/admin/login')
  await expect(page.locator('#field-email')).toBeVisible()
  await page.waitForLoadState('networkidle')
  await page.fill('#field-email', email!)
  await page.fill('#field-password', password!)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/\/admin\/?$/, { timeout: 30_000 })
}

async function postId(page: Page): Promise<string> {
  const res = await page.request.get(`/api/posts?where[slug][equals]=${SLUG}&depth=0`)
  const json = await res.json()
  return json.docs[0].id
}

async function patch(page: Page, id: string, data: Record<string, unknown>, draft: boolean) {
  const res = await page.request.patch(`/api/posts/${id}${draft ? '?draft=true' : ''}`, {
    data,
    // cookie de sessão + Origin da lista de CSRF do Payload
    headers: { Origin: new URL(page.url()).origin },
  })
  expect(res.status(), await res.text()).toBe(200)
}

test.beforeEach(async ({ page }) => {
  test.skip(!email || !password, 'defina E2E_EMAIL e E2E_PASSWORD')
  await page.setViewportSize({ width: 1440, height: 900 })
  await login(page)
})

test('rascunho: só quem está logado vê, com ?preview=1', async ({ page, browser }) => {
  const id = await postId(page)
  const draftTitle = `${TITLE} (rascunho ${run})`
  await patch(page, id, { title: draftTitle }, true)

  const anon = await browser.newPage()
  await anon.goto(`/posts/${SLUG}`)
  await expect(anon.locator('h1')).toHaveText(TITLE)
  await anon.goto(`/posts/${SLUG}?preview=1`)
  await expect(anon.locator('h1')).toHaveText(TITLE)
  await expect(anon.locator('.preview-bar')).toHaveCount(0)
  await anon.close()

  await page.goto(`/posts/${SLUG}?preview=1`)
  await expect(page.locator('h1')).toHaveText(draftTitle)
  await expect(page.locator('.preview-bar')).toContainText('Pré-visualização do rascunho')
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
  if (shotsDir) await page.screenshot({ path: `${shotsDir}/p5-08-preview-rascunho.png` })

  // volta o rascunho pro título publicado
  await patch(page, id, { title: TITLE }, true)
})

test('live preview no admin atualiza enquanto edita', async ({ page }) => {
  const id = await postId(page)
  await page.goto(`/admin/collections/posts/${id}`)
  await expect(page.locator('#field-title')).toBeVisible({ timeout: 30_000 })
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Pré-visualização' }).first().click()
  const iframe = page.locator('iframe.live-preview-iframe, .live-preview-window iframe').first()
  await expect(iframe).toBeVisible({ timeout: 30_000 })
  expect(await iframe.getAttribute('src')).toMatch(new RegExp(`/posts/${SLUG}\\?preview=1$`))
  const frame = page.frameLocator('iframe.live-preview-iframe, .live-preview-window iframe').first()
  await expect(frame.locator('h1')).toHaveText(TITLE, { timeout: 30_000 })
  await expect(frame.locator('.preview-bar')).toBeVisible()

  const live = `${TITLE} ao vivo ${run}`
  await page.locator('#field-title').fill(live)
  // autosave (1,5 s) → Payload avisa o iframe → a página recarrega o rascunho
  await expect(frame.locator('h1')).toHaveText(live, { timeout: 30_000 })
  if (shotsDir) await page.screenshot({ path: `${shotsDir}/p5-10-live-preview-admin.png` })

  await page.locator('#field-title').fill(TITLE)
  await expect(frame.locator('h1')).toHaveText(TITLE, { timeout: 30_000 })
})

test('publicar invalida o cache na hora (post, home e /blog)', async ({ page, browser }) => {
  const id = await postId(page)
  const anon = await browser.newPage()
  // aquece o cache
  for (const path of [`/posts/${SLUG}`, '/', '/blog']) {
    await anon.goto(path)
    await expect(anon.getByText(TITLE).first()).toBeVisible()
  }
  const published = `${TITLE} — atualizado ${run}`
  await patch(page, id, { title: published, _status: 'published' }, false)
  try {
    await anon.goto(`/posts/${SLUG}`)
    await expect(anon.locator('h1')).toHaveText(published)
    await anon.goto('/')
    await expect(anon.getByText(published).first()).toBeVisible()
    await anon.goto('/blog')
    await expect(anon.getByText(published).first()).toBeVisible()
  } finally {
    await patch(page, id, { title: TITLE, _status: 'published' }, false)
  }
  await anon.goto(`/posts/${SLUG}`)
  await expect(anon.locator('h1')).toHaveText(TITLE)
  await anon.close()
})
