import { expect, type Page, test } from '@playwright/test'

/**
 * Passo 6: navegação e páginas — busca (atalho "/"), tags, categorias,
 * arquivo, sobre, 404 e redirecionamentos. Roda com o banco do seed; o teste
 * de redirecionamento usa o usuário do 01-smoke.
 */
const shotsDir = process.env.SHOTS_DIR
const email = process.env.E2E_EMAIL
const password = process.env.E2E_PASSWORD
const COOKIE = 'pf-theme'
const DESKTOP = { width: 1440, height: 900 }
const MOBILE = { width: 390, height: 844 }
const run = Date.now().toString(36)

async function settle(page: Page) {
  await expect(page.locator('.theme-toggle[data-ready]')).toBeVisible()
  await page.evaluate(async () => {
    document
      .querySelectorAll('img[loading="lazy"]')
      .forEach((i) => i.setAttribute('loading', 'eager'))
    await document.fonts.ready
    await Promise.all(
      [...document.images].map((img) =>
        img.complete ? null : new Promise((r) => img.addEventListener('load', r, { once: true })),
      ),
    )
  })
}

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
}

test.describe.configure({ mode: 'serial' })

test('busca: formulário, resultados com destaque e atalho "/"', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await page.goto('/')
  await settle(page)
  await expect(page.locator('html[data-search-shortcut="ready"]')).toBeAttached()
  await page.keyboard.press('/')
  await expect(page).toHaveURL(/\/busca$/)
  const input = page.locator('#busca-q')
  await expect(input).toBeFocused()
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute('content', /noindex/)

  await input.fill('homelab')
  await input.press('Enter')
  await expect(page).toHaveURL(/\/busca\?q=homelab$/)
  await expect(page.locator('.search__status')).toContainText('para “homelab”')
  const items = page.locator('.search__item')
  expect(await items.count()).toBeGreaterThan(0)
  await expect(
    items.filter({ hasText: 'IA local no homelab' }).locator('.search__title mark'),
  ).toHaveText(['homelab'])
  await expect(items.first().locator('.search__snippet mark').first()).toBeVisible()
  await expect(page).toHaveTitle('Busca: homelab · Pronto, Falei!')

  // na própria página, "/" volta o foco pro campo
  await page.locator('h1').click()
  await page.keyboard.press('/')
  await expect(input).toBeFocused()

  // sem acento e com radical
  await page.goto('/busca?q=memoria')
  await expect(page.locator('.search__item mark', { hasText: 'memória' }).first()).toBeVisible()
  await page.goto('/busca?q=modelos')
  await expect(page.locator('.search__item', { hasText: 'IA local no homelab' })).toBeVisible()

  // nada encontrado sugere tags
  await page.goto('/busca?q=xyzzyquaseimpossivel')
  await expect(page.locator('.search__status')).toHaveText(
    'Nada encontrado para “xyzzyquaseimpossivel”.',
  )
  await expect(page.locator('.search__suggest .tag').first()).toBeVisible()
})

test('busca funciona sem JavaScript (GET /busca?q=)', async ({ browser }) => {
  const ctx = await browser.newContext({
    javaScriptEnabled: false,
    baseURL: test.info().project.use.baseURL,
  })
  const page = await ctx.newPage()
  await page.goto('/busca')
  await page.fill('#busca-q', 'backup')
  await page.locator('.search-form__btn').click()
  await expect(page).toHaveURL(/q=backup/)
  await expect(page.locator('.search__item').first()).toContainText(/backup/i)
  await ctx.close()
})

test('tags: nuvem com contagem e página da tag por ano', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  const res = await page.goto('/tags')
  expect(res?.status()).toBe(200)
  const cloud = page.locator('.tag-cloud__item')
  expect(await cloud.count()).toBeGreaterThanOrEqual(3)
  await cloud.filter({ hasText: '#homelab' }).click()
  await expect(page).toHaveURL(/\/tags\/homelab$/)
  await expect(page.locator('h1')).toHaveText('#homelab')
  await expect(page.locator('.page-head__lead')).toContainText('Servidor em casa')
  await expect(page.locator('.archive__year-title').first()).toContainText('2026')
  await expect(page.locator('.archive__item', { hasText: 'IA local no homelab' })).toBeVisible()
  await expect(page.locator('.more-tags .tag', { hasText: '#ia' })).toBeVisible()
  expect((await page.goto('/tags/nao-existe'))?.status()).toBe(404)
})

test('categorias: lista, página e link a partir do post', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await page.goto('/categorias')
  expect(await page.locator('.cat-card').count()).toBeGreaterThanOrEqual(3)
  await expect(page.locator('.cat-card', { hasText: 'Tutorial' })).toBeVisible()
  // categoria sem texto publicado não aparece
  await expect(page.locator('.cat-card__count', { hasText: '0 textos' })).toHaveCount(0)
  await page.goto('/posts/ia-local-no-homelab-sem-gpu')
  await page.locator('.post-head__cat').click()
  await expect(page).toHaveURL(/\/categorias\/tutorial$/)
  await expect(page.locator('h1')).toHaveText('Tutorial')
  const rows = page.locator('.archive__item')
  expect(await rows.count()).toBeGreaterThan(0)
  await expect(rows.locator('.meta__cat')).toHaveCount(0)
})

test('arquivo: ano › mês › título com filtro por categoria', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await page.goto('/arquivo')
  await expect(page.locator('h1')).toHaveText('Arquivo')
  await expect(page.locator('.filter__chip[aria-current="page"]')).toHaveText('Todas')
  const all = await page.locator('.archive__item').count()
  expect(all).toBeGreaterThanOrEqual(7)
  await expect(page.locator('.archive__month-title').first()).toHaveText('novembro')
  await page.locator('.filter__chip', { hasText: 'Diário' }).click()
  await expect(page).toHaveURL(/categoria=diario$/)
  await expect(page.locator('.filter__chip[aria-current="page"]')).toContainText('Diário')
  const filtered = await page.locator('.archive__item').count()
  expect(filtered).toBeGreaterThan(0)
  expect(filtered).toBeLessThan(all)
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute('content', /noindex/)
})

test('sobre: autor, texto da página e onde me achar', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await page.goto('/sobre')
  await expect(page.locator('.author__name')).toHaveText('Wilson Lima')
  await expect(page.locator('.author__role')).toContainText('fullstack')
  await expect(page.locator('.author__photo--initials')).toHaveText('WL')
  await expect(page.locator('.prose')).toContainText('Texto provisório')
  await expect(page.locator('.find-me__link', { hasText: 'RSS' })).toHaveAttribute(
    'href',
    '/feed.xml',
  )
  await expect(page).toHaveTitle('Sobre · Pronto, Falei!')
})

test('404: status, busca e sugestões', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  const res = await page.goto('/um/caminho/que/nao/existe')
  expect(res?.status()).toBe(404)
  await expect(page.locator('h1')).toHaveText('Essa página não existe.')
  await expect(page.locator('.site-header')).toBeVisible()
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute('content', /noindex/)
  // tema salvo vale no 404 também (o Next 16 manda o 404 sem o <head> do layout)
  await page
    .context()
    .addCookies([{ name: COOKIE, value: 'dark', url: new URL(page.url()).origin }])
  await page.reload()
  await settle(page)
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.fill('#busca-q', 'docker')
  await page.locator('#busca-q').press('Enter')
  await expect(page).toHaveURL(/\/busca\?q=docker$/)
})

test('redirecionamento do seed responde permanente pro post', async ({ request }) => {
  const res = await request.get('/2026/ola-mundo', { maxRedirects: 0 })
  expect(res.status()).toBe(308)
  expect(new URL(res.headers().location, 'http://x').pathname).toBe('/posts/ola-mundo-pronto-falei')
})

test('redirecionamento criado no admin vale na hora (cache invalidado)', async ({ page }) => {
  test.skip(!email || !password, 'defina E2E_EMAIL e E2E_PASSWORD')
  const from = `/antigo/backup-${run}`
  expect((await page.request.get(from, { maxRedirects: 0 })).status()).toBe(404)

  await page.setViewportSize(DESKTOP)
  await page.goto('/admin/login')
  await expect(page.locator('#field-email')).toBeVisible()
  await page.waitForLoadState('networkidle')
  await page.fill('#field-email', email!)
  await page.fill('#field-password', password!)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/\/admin\/?$/, { timeout: 30_000 })

  const post = await (
    await page.request.get(
      '/api/posts?where[slug][equals]=diario-de-bordo-backup-que-funciona&depth=0',
    )
  ).json()
  const created = await page.request.post('/api/redirects', {
    data: {
      from: `${from.toUpperCase()}/`,
      type: '301',
      to: { type: 'reference', reference: { relationTo: 'posts', value: post.docs[0].id } },
    },
    headers: { Origin: new URL(page.url()).origin },
  })
  expect(created.status(), await created.text()).toBe(201)
  const doc = (await created.json()).doc
  expect(doc.from).toBe(from)

  const res = await page.request.get(from, { maxRedirects: 0 })
  expect(res.status()).toBe(308)
  expect(new URL(res.headers().location, 'http://x').pathname).toBe(
    '/posts/diario-de-bordo-backup-que-funciona',
  )

  await page.goto('/admin/collections/redirects')
  await expect(page.locator('.table')).toContainText(from)
  if (shotsDir) await page.screenshot({ path: `${shotsDir}/p6-16-admin-redirecionamentos.png` })
  await page.goto('/admin/collections/search')
  await expect(page.locator('.table')).toContainText('IA local no homelab')
  if (shotsDir) await page.screenshot({ path: `${shotsDir}/p6-17-admin-indice-busca.png` })

  const del = await page.request.delete(`/api/redirects/${doc.id}`, {
    headers: { Origin: new URL(page.url()).origin },
  })
  expect(del.status()).toBe(200)
  expect((await page.request.get(from, { maxRedirects: 0 })).status()).toBe(404)
})

test.describe('mobile', () => {
  test.use({ viewport: MOBILE, deviceScaleFactor: 2, isMobile: true, hasTouch: true })

  test('páginas sem rolagem horizontal', async ({ page }) => {
    for (const path of [
      '/busca?q=homelab',
      '/tags',
      '/tags/homelab',
      '/categorias',
      '/categorias/tutorial',
      '/arquivo',
      '/sobre',
      '/nao-existe',
    ]) {
      await page.goto(path)
      await settle(page)
      await noHorizontalScroll(page)
    }
  })
})

test('prints: desktop e mobile, claro e escuro', async ({ browser }) => {
  test.skip(!shotsDir, 'defina SHOTS_DIR')
  const baseURL = test.info().project.use.baseURL || 'http://localhost:3130'
  const views = {
    desktop: { viewport: DESKTOP, deviceScaleFactor: 1 },
    mobile: { viewport: MOBILE, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  } as const
  const shots: [string, string, keyof typeof views, 'claro' | 'escuro'][] = [
    ['p6-01-busca-desktop-claro', '/busca?q=homelab', 'desktop', 'claro'],
    ['p6-02-busca-desktop-escuro', '/busca?q=homelab', 'desktop', 'escuro'],
    ['p6-03-busca-mobile-claro', '/busca?q=homelab', 'mobile', 'claro'],
    ['p6-04-busca-mobile-escuro', '/busca?q=homelab', 'mobile', 'escuro'],
    ['p6-05-arquivo-desktop-claro', '/arquivo', 'desktop', 'claro'],
    ['p6-06-arquivo-mobile-escuro', '/arquivo?categoria=opiniao', 'mobile', 'escuro'],
    ['p6-07-tag-desktop-escuro', '/tags/homelab', 'desktop', 'escuro'],
    ['p6-08-tags-mobile-claro', '/tags', 'mobile', 'claro'],
    ['p6-09-categoria-desktop-claro', '/categorias/tutorial', 'desktop', 'claro'],
    ['p6-10-categorias-mobile-escuro', '/categorias', 'mobile', 'escuro'],
    ['p6-11-sobre-desktop-claro', '/sobre', 'desktop', 'claro'],
    ['p6-12-sobre-mobile-escuro', '/sobre', 'mobile', 'escuro'],
    ['p6-13-404-desktop-escuro', '/esse-link-quebrou', 'desktop', 'escuro'],
    ['p6-14-404-mobile-claro', '/esse-link-quebrou', 'mobile', 'claro'],
    ['p6-15-busca-sem-resultado-desktop-claro', '/busca?q=kubernetes', 'desktop', 'claro'],
  ]
  for (const [name, path, view, theme] of shots) {
    const ctx = await browser.newContext({ ...views[view], baseURL })
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
    await settle(page)
    // campo de busca sem foco, pra o print não pegar o cursor piscando
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
    await page.screenshot({ path: `${shotsDir}/${name}.png`, fullPage: true })
    await ctx.close()
  }
})
