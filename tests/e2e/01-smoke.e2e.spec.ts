import { expect, test } from '@playwright/test'

/**
 * Smoke do esqueleto: home, /api/health e admin.
 * As credenciais vêm do ambiente (E2E_EMAIL / E2E_PASSWORD) e só servem
 * pra um banco descartável de dev/CI. Nunca rode contra produção.
 */
const email = process.env.E2E_EMAIL
const password = process.env.E2E_PASSWORD
const shotsDir = process.env.SHOTS_DIR

test.describe.configure({ mode: 'serial' })

test('home mostra o wordmark', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/Pronto, Falei!/)
  await expect(page.locator('h1.wordmark')).toContainText('Pronto, Falei!')
  if (shotsDir) await page.screenshot({ path: `${shotsDir}/01-home.png`, fullPage: true })
})

test('/api/health responde ok', async ({ request }) => {
  const res = await request.get('/api/health')
  expect(res.status()).toBe(200)
  expect(await res.json()).toEqual({ status: 'ok', checks: { mongo: 'ok', bucket: 'ok' } })
})

test('admin: cria o primeiro usuário (ou faz login) e abre o dashboard', async ({ page }) => {
  test.skip(!email || !password, 'defina E2E_EMAIL e E2E_PASSWORD')

  await page.goto('/admin')
  await expect(page).toHaveURL(/\/admin\/(create-first-user|login)/, { timeout: 30_000 })
  await expect(page.locator('#field-email')).toBeVisible()
  // Espera a hidratação do React antes de preencher (senão o estado se perde).
  await page.waitForLoadState('networkidle')

  if (page.url().includes('create-first-user')) {
    if (shotsDir)
      await page.screenshot({ path: `${shotsDir}/02-admin-create-first-user.png`, fullPage: true })
    await page.fill('#field-email', email!)
    await page.fill('#field-password', password!)
    await page.fill('#field-confirm-password', password!)
    const name = page.locator('#field-name')
    if (await name.count()) await name.fill('Usuário de teste')
    if (shotsDir)
      await page.screenshot({
        path: `${shotsDir}/03-admin-create-first-user-preenchido.png`,
        fullPage: true,
      })
    await page.click('button[type="submit"]')
  } else {
    await page.fill('#field-email', email!)
    await page.fill('#field-password', password!)
    await page.click('button[type="submit"]')
  }

  await expect(page).toHaveURL(/\/admin\/?$/, { timeout: 30_000 })
  await expect(page.locator('a[href="/admin/collections/users"]').first()).toBeVisible()
  if (shotsDir)
    await page.screenshot({ path: `${shotsDir}/04-admin-dashboard.png`, fullPage: true })

  await page.goto('/admin/collections/users')
  await expect(page.getByText(email!).first()).toBeVisible()
  if (shotsDir) await page.screenshot({ path: `${shotsDir}/05-admin-usuarios.png`, fullPage: true })

  await page.goto('/admin/collections/media')
  await expect(page.locator('h1').first()).toBeVisible()
  if (shotsDir) await page.screenshot({ path: `${shotsDir}/06-admin-midias.png`, fullPage: true })
})
