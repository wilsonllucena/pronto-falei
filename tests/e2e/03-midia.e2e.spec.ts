import { expect, type Page, test } from '@playwright/test'
import sharp from 'sharp'

/**
 * Passo 3: upload de imagem pelo admin vai pro MinIO, gera os tamanhos em
 * WebP e a URL pública abre sem login.
 */
const email = process.env.E2E_EMAIL
const password = process.env.E2E_PASSWORD
const shotsDir = process.env.SHOTS_DIR
const run = Date.now().toString(36)

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

/** Imagem de teste 1800×1000 com o wordmark, gerada na hora. */
async function testImage(): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1000">
    <rect width="100%" height="100%" fill="#FAF7F0"/>
    <rect x="980" y="560" width="560" height="90" fill="#FFD23F"/>
    <text x="900" y="600" font-family="sans-serif" font-weight="800" font-size="150" text-anchor="middle" fill="#1B1B1B">Pronto, <tspan fill="#D9480F">Falei!</tspan></text>
    <text x="900" y="760" font-family="sans-serif" font-size="48" text-anchor="middle" fill="#6B665E">imagem de teste do passo 3</text>
  </svg>`
  return sharp(Buffer.from(svg)).png().toBuffer()
}

let mediaUrl = ''
let cardUrl = ''

test.beforeEach(async ({ page }) => {
  test.skip(!email || !password, 'defina E2E_EMAIL e E2E_PASSWORD')
  await page.setViewportSize({ width: 1440, height: 1300 })
  await login(page)
})

test('envia uma imagem pelo admin e ela vai pro MinIO com os tamanhos', async ({
  page,
  request,
}) => {
  await page.goto('/admin/collections/media/create')
  await expect(page.locator('#field-alt')).toBeVisible({ timeout: 30_000 })
  await page.waitForLoadState('networkidle')

  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: `capa-teste-${run}.png`,
      mimeType: 'image/png',
      buffer: await testImage(),
    })
  await page.fill('#field-alt', `Wordmark do Pronto, Falei! (teste ${run})`)
  await page.fill('#field-caption', 'Imagem gerada no teste do passo 3')
  await page.fill('#field-credit', 'Pronto, Falei!')
  await shot(page, 'p3-01-upload-preenchido')

  await page.click('#action-save')
  await expect(page).toHaveURL(/\/admin\/collections\/media\/[a-f0-9]{24}/, { timeout: 60_000 })
  await page.reload()
  await page.waitForLoadState('networkidle')
  await shot(page, 'p3-02-midia-salva')
  await page
    .getByRole('button', { name: /Tamanhos/i })
    .first()
    .click()
  await expect(page.getByText(/og/).first()).toBeVisible()
  await page.waitForLoadState('networkidle')
  // espera a animação de abertura do modal terminar antes do print
  await page.waitForTimeout(1_000)
  await shot(page, 'p3-03-tamanhos-webp')
  await page.keyboard.press('Escape')

  const id = page.url().match(/media\/([a-f0-9]{24})/)![1]
  const api = await request.get(`/api/media/${id}`, {
    headers: {
      Cookie: (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join('; '),
    },
  })
  expect(api.status()).toBe(200)
  const doc = await api.json()
  mediaUrl = doc.url
  cardUrl = doc.sizes.card.url
  expect(doc.url).toMatch(/^https?:\/\/[^/]+(\/[^/]+)?\/media\//)
  expect(doc.sizes.thumb).toMatchObject({ width: 400, mimeType: 'image/webp' })
  expect(doc.sizes.card).toMatchObject({ width: 800, mimeType: 'image/webp' })
  expect(doc.sizes.hero).toMatchObject({ width: 1600, mimeType: 'image/webp' })
  expect(doc.sizes.og).toMatchObject({ width: 1200, height: 630, mimeType: 'image/webp' })
})

test('a URL pública da imagem abre sem login', async ({ browser }) => {
  expect(cardUrl).not.toBe('')
  const anon = await browser.newContext({ viewport: { width: 1000, height: 600 } })
  const res = await anon.request.get(cardUrl)
  expect(res.status()).toBe(200)
  expect(res.headers()['content-type']).toBe('image/webp')
  const page = await anon.newPage()
  await page.goto(cardUrl)
  await shot(page, 'p3-04-url-publica-card-webp')
  await anon.close()
  expect((await (await browser.newContext()).request.get(mediaUrl)).status()).toBe(200)
})

test('lista de mídias mostra a miniatura vinda do MinIO', async ({ page }) => {
  await page.goto('/admin/collections/media')
  const thumb = page.locator(`img[src*="-400x"]`).first()
  await expect(thumb).toBeVisible({ timeout: 30_000 })
  await expect
    .poll(() => thumb.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth))
    .toBeGreaterThan(0)
  await shot(page, 'p3-05-lista-midias')
})

test('health mostra mongo e bucket ok', async ({ page }) => {
  await page.goto('/api/health')
  await expect(page.locator('body')).toContainText('"bucket":"ok"')
  await shot(page, 'p3-06-health')
})
