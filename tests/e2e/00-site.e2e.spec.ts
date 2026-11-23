import { expect, type Page, test } from '@playwright/test'

/**
 * Passo 4: design system e layout do site (home, /blog, header, footer,
 * tema claro/escuro). Roda antes dos testes do admin, com o banco só com o
 * seed de desenvolvimento (o CI roda o seed nos testes de integração).
 */
const shotsDir = process.env.SHOTS_DIR
const COOKIE = 'pf-theme'

const DESKTOP = { width: 1440, height: 900 }
const MOBILE = { width: 390, height: 844 }

/**
 * Espera a hidratação (os componentes de cliente marcam data-ready), as fontes
 * e as capas. Não dá pra usar networkidle: o Next deixa abertos os prefetches
 * de rotas que só chegam nos próximos passos (post, tags, sobre, busca).
 */
async function settle(page: Page) {
  await expect(page.locator('.theme-toggle[data-ready]')).toBeVisible()
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all(
      [...document.images].map((img) =>
        img.complete || img.loading === 'lazy'
          ? null
          : new Promise((r) => img.addEventListener('load', r, { once: true })),
      ),
    )
  })
}

const shot = async (page: Page, name: string) => {
  if (!shotsDir) return
  await page.evaluate(() =>
    document
      .querySelectorAll('img[loading="lazy"]')
      .forEach((i) => i.setAttribute('loading', 'eager')),
  )
  await settle(page)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: `${shotsDir}/${name}.png`, fullPage: true })
}

const bg = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor)

test.describe.configure({ mode: 'serial' })

test('home: header, hero, destaques, recentes por mês e footer', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await page.goto('/')
  await expect(page).toHaveTitle('Pronto, Falei!')

  const header = page.locator('header.site-header')
  await expect(header.locator('.wordmark')).toHaveText('Pronto, Falei!')
  await expect(header.locator('.wordmark__falei')).toHaveText('Falei!')
  const nav = page.getByRole('navigation', { name: 'Principal' })
  for (const label of ['Blog', 'Arquivo', 'Sobre']) {
    await expect(nav.getByRole('link', { name: label })).toBeVisible()
  }
  await expect(header.getByRole('link', { name: 'Buscar' })).toBeVisible()
  await expect(header.getByRole('button', { name: 'Alternar tema claro/escuro' })).toBeVisible()

  await expect(page.locator('h1.hero__title')).toHaveText(
    'Ideias, opiniões e descobertas, sem rodeios.',
  )
  await expect(page.getByRole('link', { name: 'RSS' }).first()).toHaveAttribute('href', '/rss.xml')

  const featured = page.locator('.featured .card')
  await expect(featured).toHaveCount(3)
  await expect(featured.first().locator('.card__title')).toHaveText(
    'IA local no homelab, sem GPU e sem drama',
  )
  await expect(featured.first().locator('img.cover')).toHaveAttribute('src', /\.webp$/)
  // desktop: os 3 destaques lado a lado e sem os botões do carrossel
  await expect(page.locator('.featured__controls')).toBeHidden()

  const months = page.locator('#lista-recentes .month__head')
  await expect(months.first()).toContainText(/novembro de 2026/i)
  await expect(months.first()).toContainText('textos')
  await expect(page.locator('#lista-recentes .row').first()).toContainText('20 nov')

  const footer = page.locator('footer.site-footer')
  await expect(footer.getByRole('navigation', { name: 'Tags populares' })).toContainText('#homelab')
  await expect(footer.getByRole('link', { name: 'Sobre o Wilson' })).toBeVisible()
  await expect(footer.getByRole('link', { name: 'llms.txt' })).toBeVisible()

  // fontes do próprio site, sem Google Fonts
  const fonts = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .map((r) => r.name)
      .filter((n) => /\.woff2|fonts\.g/.test(n)),
  )
  expect(fonts.length).toBeGreaterThan(0)
  expect(fonts.every((n) => !/googleapis|gstatic/.test(n))).toBe(true)
  const family = await page.evaluate(
    () => getComputedStyle(document.querySelector('.hero__title')!).fontFamily,
  )
  expect(family).toMatch(/display|Bricolage/i)
})

test('tema: segue o sistema, alterna no botão e lembra no cookie sem piscar', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/')
  await settle(page)
  expect(await bg(page)).toBe('rgb(20, 20, 20)')

  await page.emulateMedia({ colorScheme: 'light' })
  expect(await bg(page)).toBe('rgb(250, 247, 240)')

  await page.getByRole('button', { name: 'Alternar tema claro/escuro' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  expect(await bg(page)).toBe('rgb(20, 20, 20)')
  const cookie = (await page.context().cookies()).find((c) => c.name === COOKIE)
  expect(cookie?.value).toBe('dark')

  // recarrega com o sistema claro: o cookie vence já no HTML inicial
  let firstPaintTheme: string | null = null
  page.once('domcontentloaded', async () => {
    firstPaintTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'))
  })
  await page.reload()
  await expect.poll(() => firstPaintTheme).toBe('dark')
  expect(await bg(page)).toBe('rgb(20, 20, 20)')

  await page.getByRole('button', { name: 'Alternar tema claro/escuro' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.context().clearCookies()
})

test('lista/grade: alterna e lembra a escolha', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await page.goto('/')
  await settle(page)
  const list = page.locator('#lista-recentes')
  await expect(list).toHaveAttribute('data-view', 'lista')
  await page.getByRole('button', { name: 'Grade' }).click()
  await expect(list).toHaveAttribute('data-view', 'grade')
  await expect(page.getByRole('button', { name: 'Grade' })).toHaveAttribute('aria-pressed', 'true')
  await expect(list.locator('.row__media').first()).toBeVisible()
  await shot(page, 'p4-05-home-grade-desktop-claro')
  await page.reload()
  await expect(page.locator('#lista-recentes')).toHaveAttribute('data-view', 'grade')
  await page.getByRole('button', { name: 'Lista' }).click()
  await expect(page.locator('#lista-recentes')).toHaveAttribute('data-view', 'lista')
})

test('acessibilidade: pular para o conteúdo e foco visível', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await page.goto('/')
  await settle(page)
  await page.keyboard.press('Tab')
  const skip = page.getByRole('link', { name: 'Pular para o conteúdo' })
  await expect(skip).toBeFocused()
  await expect(skip).toBeInViewport()
  const outline = await skip.evaluate((el) => getComputedStyle(el).outlineStyle)
  expect(outline).toBe('solid')
  await skip.press('Enter')
  await expect(page).toHaveURL(/#conteudo$/)
})

test.describe('mobile', () => {
  test.use({ viewport: MOBILE, deviceScaleFactor: 2, isMobile: true, hasTouch: true })

  test('menu recolhido, carrossel de destaques e alvos de 44px', async ({ page }) => {
    await page.goto('/')
    await settle(page)
    await expect(page.getByRole('navigation', { name: 'Principal' })).toBeHidden()
    const menuBtn = page.locator('.mobile-menu > summary')
    const box = await menuBtn.boundingBox()
    expect(box!.width).toBeGreaterThanOrEqual(44)
    expect(box!.height).toBeGreaterThanOrEqual(44)

    // sem rolagem horizontal na página
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)

    const controls = page.locator('.featured__controls')
    await expect(controls).toBeVisible()
    await expect(controls).toContainText('1/3')
    await page.getByRole('button', { name: 'Próximo destaque' }).click()
    await expect(controls).toContainText('2/3')
    await page.getByRole('button', { name: 'Destaque anterior' }).click()
    await expect(controls).toContainText('1/3')

    await menuBtn.click()
    const menu = page.getByRole('navigation', { name: 'Menu' })
    await expect(menu.getByRole('link', { name: 'Sobre' })).toBeVisible()
    if (shotsDir) await page.screenshot({ path: `${shotsDir}/p4-06-menu-mobile.png` })
    await menuBtn.click()
  })
})

test('/blog: lista completa agrupada por mês', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await page.goto('/blog')
  await expect(page).toHaveTitle('Blog · Pronto, Falei!')
  await expect(page.locator('h1')).toHaveText('Blog')
  await expect(page.locator('.page-head__lead')).toContainText('textos')
  const groups = page.locator('#lista-blog .month__head')
  expect(await groups.count()).toBeGreaterThanOrEqual(3)
  await page.goto('/blog?pagina=99')
  await expect(page.getByText('Nada por aqui nessa página.')).toBeVisible()
})

test('prints: desktop e mobile, claro e escuro', async ({ browser }) => {
  test.skip(!shotsDir, 'defina SHOTS_DIR')
  const baseURL = test.info().project.use.baseURL || 'http://localhost:3130'
  const views = [
    ['desktop', { viewport: DESKTOP, deviceScaleFactor: 1 }],
    ['mobile', { viewport: MOBILE, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
  ] as const
  let n = 0
  for (const path of ['/', '/blog']) {
    for (const [name, opts] of views) {
      for (const theme of ['claro', 'escuro'] as const) {
        const ctx = await browser.newContext({ ...opts, baseURL })
        await ctx.addCookies([
          {
            name: COOKIE,
            value: theme === 'claro' ? 'light' : 'dark',
            domain: new URL(baseURL).hostname,
            path: '/',
          },
        ])
        const page = await ctx.newPage()
        await page.goto(path)
        n += 1
        const slot = n <= 4 ? n : n + 2 // 05 e 06 são grade e menu
        const label = path === '/' ? 'home' : 'blog'
        await shot(page, `p4-${String(slot).padStart(2, '0')}-${label}-${name}-${theme}`)
        await ctx.close()
      }
    }
  }
})
