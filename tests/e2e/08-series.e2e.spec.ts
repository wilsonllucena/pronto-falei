import { expect, type Page, test } from '@playwright/test'

/**
 * Passo 9: séries (Parte N de M, anterior/próxima) e "Leia também" por tags e
 * categoria. Roda com o banco do seed (série "Homelab do zero"); o print do
 * admin usa o usuário do E2E.
 */
const shotsDir = process.env.SHOTS_DIR
const email = process.env.E2E_EMAIL
const password = process.env.E2E_PASSWORD
const COOKIE = 'pf-theme'
const DESKTOP = { width: 1440, height: 900 }
const MOBILE = { width: 390, height: 844 }
const MID = 'diario-de-bordo-backup-que-funciona'

async function settle(page: Page) {
  await expect(page.locator('.theme-toggle[data-ready]')).toBeVisible()
  await page.evaluate(async () => {
    await document.fonts.ready
  })
}

async function shotSeries(page: Page, name: string) {
  if (!shotsDir) return
  const box = page.locator('.series')
  await box.scrollIntoViewIfNeeded()
  await page.evaluate(() => {
    const el = document.querySelector('.series')
    el?.scrollIntoView({ block: 'start' })
    window.scrollBy(0, -90)
  })
  await page.screenshot({ path: `${shotsDir}/${name}.png` })
}

test.describe.configure({ mode: 'serial' })

test('série: parte do meio com lista, anterior e próxima', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  const res = await page.goto(`/posts/${MID}`)
  expect(res?.status()).toBe(200)
  const series = page.getByRole('navigation', { name: 'Homelab do zero' })
  await expect(series).toBeVisible()
  await expect(series.locator('.series__eyebrow')).toHaveText('Parte 2 de 3 da série')
  await expect(series.locator('.series__desc')).toContainText('Do mini PC ao blog no ar')
  const parts = series.locator('.series__part')
  await expect(parts).toHaveCount(3)
  await expect(parts.nth(0)).toContainText('Payload')
  await expect(series.locator('[aria-current="page"]')).toHaveText(
    await page.locator('.post-head h1').innerText(),
  )
  await expect(series.locator('a[rel="prev"]')).toHaveAttribute(
    'href',
    '/posts/payload-cms-mongodb-minio-docker',
  )
  await expect(series.locator('a[rel="next"]')).toHaveAttribute(
    'href',
    '/posts/ia-local-no-homelab-sem-gpu',
  )

  // a série vem antes do "Leia também"
  const related = page.locator('.related')
  await expect(related.locator('h2')).toHaveText('Leia também')
  const n = await related.locator('.related__item').count()
  expect(n).toBeGreaterThan(0)
  expect(n).toBeLessThanOrEqual(3)
  // sem repetir o próprio post nem as partes da série
  for (const href of [
    `/posts/${MID}`,
    '/posts/payload-cms-mongodb-minio-docker',
    '/posts/ia-local-no-homelab-sem-gpu',
  ]) {
    await expect(related.locator(`a[href="${href}"]`)).toHaveCount(0)
  }
  const seriesBox = await series.boundingBox()
  const relatedBox = await related.boundingBox()
  expect(seriesBox!.y).toBeLessThan(relatedBox!.y)

  await settle(page)
  await shotSeries(page, 'p9-01-serie-desktop-claro')
})

test('série: próxima leva à última parte, que não tem próxima', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await page.goto(`/posts/${MID}`)
  await page.locator('.series a[rel="next"]').click()
  await expect(page).toHaveURL(/\/posts\/ia-local-no-homelab-sem-gpu$/)
  const series = page.locator('.series')
  await expect(series.locator('.series__eyebrow')).toHaveText('Parte 3 de 3 da série')
  await expect(series.locator('a[rel="next"]')).toHaveCount(0)
  await expect(series.locator('a[rel="prev"]')).toHaveAttribute('href', `/posts/${MID}`)

  await page.goto('/posts/payload-cms-mongodb-minio-docker')
  await expect(page.locator('.series__eyebrow')).toHaveText('Parte 1 de 3 da série')
  await expect(page.locator('.series a[rel="prev"]')).toHaveCount(0)
})

test('post fora de série não mostra a caixa, mas tem relacionados', async ({ page }) => {
  await page.goto('/posts/o-mito-do-dev-10x')
  await expect(page.locator('.post-head h1')).toBeVisible()
  await expect(page.locator('.series')).toHaveCount(0)
  await expect(page.locator('.related .related__item').first()).toBeVisible()
})

test('prints: escuro, mobile claro e mobile escuro', async ({ browser, baseURL }) => {
  test.skip(!shotsDir, 'só com SHOTS_DIR')
  const views = [
    ['p9-02-serie-desktop-escuro', { viewport: DESKTOP }, 'dark'],
    [
      'p9-03-serie-mobile-claro',
      { viewport: MOBILE, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
      'light',
    ],
    [
      'p9-04-serie-mobile-escuro',
      { viewport: MOBILE, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
      'dark',
    ],
  ] as const
  for (const [name, opts, theme] of views) {
    const ctx = await browser.newContext({ ...opts, baseURL })
    await ctx.addCookies([
      { name: COOKIE, value: theme, domain: new URL(baseURL!).hostname, path: '/' },
    ])
    const page = await ctx.newPage()
    await page.goto(`/posts/${MID}`)
    await settle(page)
    await expect(page.locator('.series')).toBeVisible()
    await shotSeries(page, name)
    if (name === 'p9-03-serie-mobile-claro') {
      await page.locator('.related').scrollIntoViewIfNeeded()
      await page.evaluate(() => {
        document.querySelector('.related')?.scrollIntoView({ block: 'start' })
        window.scrollBy(0, -80)
      })
      await page.screenshot({ path: `${shotsDir}/p9-05-leia-tambem-mobile.png` })
    }
    await ctx.close()
  }
})

test('admin: coleção Séries com os posts na ordem', async ({ page }) => {
  test.skip(!email || !password, 'defina E2E_EMAIL e E2E_PASSWORD')
  await page.setViewportSize(DESKTOP)
  await page.goto('/admin/login')
  await expect(page.locator('#field-email')).toBeVisible()
  await page.waitForLoadState('networkidle')
  await page.fill('#field-email', email!)
  await page.fill('#field-password', password!)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/\/admin\/?$/, { timeout: 30_000 })

  await page.goto('/admin/collections/series')
  const row = page.getByRole('link', { name: 'Homelab do zero' }).first()
  await expect(row).toBeVisible()
  await row.click()
  await expect(page.locator('#field-title')).toHaveValue('Homelab do zero')
  const chips = page.locator(
    '#field-posts .multi-value-label, #field-posts .relationship--multi-value-label__text',
  )
  await expect(chips.first()).toBeVisible()
  if (shotsDir) await page.screenshot({ path: `${shotsDir}/p9-06-admin-serie.png` })
})
