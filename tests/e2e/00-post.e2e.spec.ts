import { expect, type Page, test } from '@playwright/test'

/**
 * Passo 5: página do post (render do Lexical e blocos, Shiki, índice, resumo
 * rápido, relacionados e OG image). Público: roda com o banco só com o seed.
 */
const shotsDir = process.env.SHOTS_DIR
const COOKIE = 'pf-theme'
const SLUG = 'ia-local-no-homelab-sem-gpu'
const DESKTOP = { width: 1440, height: 900 }
const MOBILE = { width: 390, height: 844 }

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

test.describe.configure({ mode: 'serial' })

test('post: cabeçalho, resumo rápido, corpo com blocos e relacionados', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  const res = await page.goto(`/posts/${SLUG}`)
  expect(res?.status()).toBe(200)
  await expect(page).toHaveTitle('IA local no homelab, sem GPU e sem drama · Pronto, Falei!')

  const head = page.locator('.post-head')
  await expect(head.locator('h1')).toHaveText('IA local no homelab, sem GPU e sem drama')
  await expect(head.locator('.post-head__subtitle')).toContainText('4B parâmetros')
  await expect(head.locator('.post-head__cat')).toHaveText('Tutorial')
  await expect(head.locator('time')).toHaveText('20 nov 2026')
  await expect(head.locator('.post-head__cover img')).toHaveAttribute('src', /1600x960\.webp$/)

  const summary = page.locator('details.summary')
  await expect(summary).toHaveAttribute('open', '')
  await expect(summary.locator('.summary__tldr')).toContainText('Rodei um modelo')
  await expect(summary.locator('.summary__points li')).toHaveCount(3)
  await expect(summary.getByRole('link', { name: 'Ler em Markdown' })).toHaveAttribute(
    'href',
    `/posts/${SLUG}.md`,
  )
  const claude = summary.getByRole('link', { name: 'Claude' })
  expect(decodeURIComponent((await claude.getAttribute('href'))!)).toContain(`/posts/${SLUG}.md`)

  const prose = page.locator('.prose')
  await expect(prose.locator('h2#por-que-um-modelo-pequeno')).toBeVisible()
  await expect(prose.locator('h3#os-numeros-do-teste')).toBeVisible()
  await expect(prose.locator('ul li')).toHaveCount(3)
  await expect(prose.locator('strong').first()).toHaveText('nada sai do homelab')
  await expect(prose.locator('a[href="https://github.com/ggml-org/llama.cpp"]')).toBeVisible()
  await expect(prose.locator('.callout--dica')).toContainText('Dica de homelab')
  await expect(prose.locator('.quote blockquote')).toContainText('A solução mais simples')
  await expect(prose.locator('.embed__card')).toContainText('Ver @ggml_org no X')
  await expect(prose.locator('.figure img')).toHaveAttribute('src', /\.webp$/)
  await expect(prose.locator('.figure figcaption')).toContainText('A fila processa')

  // código: Shiki com os dois temas, título do arquivo e botão copiar
  const codes = prose.locator('figure.code')
  await expect(codes).toHaveCount(3)
  await expect(codes.nth(1).locator('.code__title')).toHaveText('docker-compose.yml')
  await expect(
    codes.first().locator('pre.shiki span[style*="--shiki-dark"]').first(),
  ).toBeAttached()

  // relacionados por tags em comum
  const related = page.locator('.related')
  await expect(related.locator('h2')).toHaveText('Leia também')
  const n = await related.locator('.related__item').count()
  expect(n).toBeGreaterThan(0)
  expect(n).toBeLessThanOrEqual(3)
})

test('índice lateral no desktop marca a seção e leva até a âncora', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await page.goto(`/posts/${SLUG}`)
  await settle(page)
  const side = page.getByRole('navigation', { name: 'Nesta página' })
  await expect(side).toBeVisible()
  await expect(page.locator('details.toc--mobile')).toBeHidden()
  await side.getByRole('link', { name: 'Subindo o servidor' }).click()
  await expect(page).toHaveURL(/#subindo-o-servidor$/)
  await expect(page.locator('h2#subindo-o-servidor')).toBeInViewport()
  await expect(side.locator('a[aria-current="true"]')).toHaveText('Subindo o servidor')
})

test('copiar código e resumo que lembra se foi fechado', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.setViewportSize(DESKTOP)
  await page.goto(`/posts/${SLUG}`)
  await settle(page)
  const copy = page.locator('figure.code').nth(1).getByRole('button', { name: 'Copiar' })
  await copy.click()
  await expect(page.locator('figure.code').nth(1).locator('.code__copy')).toHaveText('Copiado!')
  const clip = await page.evaluate(() => navigator.clipboard.readText())
  expect(clip).toContain('services:\n  llm:')

  await expect(page.locator('details.summary[data-ready]')).toBeAttached()
  await page.locator('.summary__head').click()
  await expect(page.locator('details.summary')).not.toHaveAttribute('open', '')
  await page.reload()
  await expect(page.locator('details.summary[data-ready]')).toBeAttached()
  await expect(page.locator('details.summary')).not.toHaveAttribute('open', '')
  await page.locator('.summary__head').click()
  await expect(page.locator('details.summary')).toHaveAttribute('open', '')
})

test('metadados e OG image automática (1200×630)', async ({ page, request }) => {
  await page.goto(`/posts/${SLUG}`)
  const og = await page.locator('meta[property="og:image"]').first().getAttribute('content')
  expect(og).toMatch(new RegExp(`/posts/${SLUG}/opengraph-image`))
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'article')
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    new RegExp(`/posts/${SLUG}$`),
  )
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    /Rodei um modelo/,
  )
  const img = await request.get(new URL(og!).pathname + new URL(og!).search)
  expect(img.status()).toBe(200)
  expect(img.headers()['content-type']).toBe('image/png')
  const body = await img.body()
  expect(body.readUInt32BE(16)).toBe(1200)
  expect(body.readUInt32BE(20)).toBe(630)
  if (shotsDir) {
    const fs = await import('node:fs/promises')
    await fs.writeFile(`${shotsDir}/p5-09-og-image.png`, body)
  }
})

test('post inexistente dá 404 e rascunho não vaza sem login', async ({ page }) => {
  const res = await page.goto('/posts/nao-existe-esse-post')
  expect(res?.status()).toBe(404)
  const preview = await page.goto(`/posts/${SLUG}?preview=1`)
  expect(preview?.status()).toBe(200)
  await expect(page.locator('.preview-bar')).toHaveCount(0)
})

test.describe('mobile', () => {
  test.use({ viewport: MOBILE, deviceScaleFactor: 2, isMobile: true, hasTouch: true })

  test('índice recolhido "Índice ▾" e sem rolagem horizontal', async ({ page }) => {
    await page.goto(`/posts/${SLUG}`)
    await settle(page)
    await expect(page.getByRole('navigation', { name: 'Nesta página' })).toBeHidden()
    const toc = page.locator('details.toc--mobile')
    await expect(toc).toBeVisible()
    await toc.locator('summary').click()
    await expect(toc.getByRole('link', { name: 'O que eu aprendi' })).toBeVisible()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
    if (shotsDir) {
      await page.evaluate(() => window.scrollTo(0, 0))
      await toc.scrollIntoViewIfNeeded()
      await page.screenshot({ path: `${shotsDir}/p5-07-indice-mobile.png` })
    }
  })
})

test('prints: desktop e mobile, claro e escuro', async ({ browser }) => {
  test.skip(!shotsDir, 'defina SHOTS_DIR')
  const baseURL = test.info().project.use.baseURL || 'http://localhost:3130'
  const views = [
    ['desktop', { viewport: DESKTOP, deviceScaleFactor: 1 }],
    ['mobile', { viewport: MOBILE, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
  ] as const
  let n = 0
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
      await page.goto(`/posts/${SLUG}`)
      await settle(page)
      n += 1
      await page.screenshot({
        path: `${shotsDir}/p5-0${n}-post-${name}-${theme}.png`,
        fullPage: true,
      })
      if (name === 'desktop' && theme === 'escuro') {
        // trecho do código no escuro, com o índice fixo ao lado
        await page.locator('h2#subindo-o-servidor').scrollIntoViewIfNeeded()
        await page.evaluate(() => window.scrollBy(0, -80))
        await page.screenshot({ path: `${shotsDir}/p5-05-codigo-e-indice-escuro.png` })
      }
      if (name === 'desktop' && theme === 'claro') {
        await page.locator('.callout').scrollIntoViewIfNeeded()
        await page.evaluate(() => window.scrollBy(0, -200))
        await page.screenshot({ path: `${shotsDir}/p5-06-blocos-claro.png` })
      }
      await ctx.close()
    }
  }
})
