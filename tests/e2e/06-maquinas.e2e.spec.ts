import { expect, type Page, test } from '@playwright/test'

/**
 * Passo 7: leitura por IA — /posts/slug.md, "Ler em Markdown", llms.txt,
 * llms-full.txt, JSON-LD, rel=alternate, RSS/Atom/JSON Feed, sitemap e
 * robots. Roda com o banco do seed; o teste de publicação usa o usuário do
 * 01-smoke.
 */
const shotsDir = process.env.SHOTS_DIR
const email = process.env.E2E_EMAIL
const password = process.env.E2E_PASSWORD
const COOKIE = 'pf-theme'
const DESKTOP = { width: 1440, height: 900 }
const MOBILE = { width: 390, height: 844 }
const SLUG = 'ia-local-no-homelab-sem-gpu'
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

async function setTheme(page: Page, theme: 'light' | 'dark') {
  await page.context().addCookies([{ name: COOKIE, value: theme, url: new URL(page.url()).origin }])
}

async function ldJson(page: Page) {
  const raw = await page.locator('script[type="application/ld+json"]').allTextContents()
  return raw.map((r) => JSON.parse(r) as Record<string, unknown>)
}

async function shot(page: Page, name: string) {
  if (shotsDir) await page.screenshot({ path: `${shotsDir}/${name}.png` })
}

test.describe.configure({ mode: 'serial' })

test('/posts/slug.md: Markdown com frontmatter, corpo e link canônico', async ({ request }) => {
  const res = await request.get(`/posts/${SLUG}.md`)
  expect(res.status()).toBe(200)
  expect(res.headers()['content-type']).toBe('text/markdown; charset=utf-8')
  expect(res.headers()['link']).toMatch(new RegExp(`/posts/${SLUG}>; rel="canonical"`))
  const md = await res.text()
  expect(md).toMatch(/^---\ntitle: "IA local no homelab, sem GPU e sem drama"\n/)
  for (const key of ['published:', 'updated:', 'tags: [', 'summary: "', 'key_points:\n  - '])
    expect(md).toContain(key)
  expect(md).toContain('# IA local no homelab, sem GPU e sem drama')
  expect(md).toContain('**Pontos-chave**')
  expect(md).toMatch(/\n## .+\n/)
  expect(md).not.toContain('[object Object]')
  expect(md).not.toMatch(/<\/?(p|div|span)[ >]/)

  const missing = await request.get('/posts/nao-existe.md')
  expect(missing.status()).toBe(404)
  const sobre = await request.get('/sobre.md')
  expect(sobre.status()).toBe(200)
  expect(await sobre.text()).toMatch(/^---\ntitle: "Sobre"[\s\S]*\n# Sobre\n/)
})

test('post: "Ler em Markdown", rel=alternate e JSON-LD BlogPosting', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await page.goto(`/posts/${SLUG}`)
  await settle(page)

  await expect(page.locator('link[rel="alternate"][type="text/markdown"]')).toHaveAttribute(
    'href',
    new RegExp(`/posts/${SLUG}\\.md$`),
  )
  for (const [type, href] of [
    ['application/rss+xml', '/rss.xml'],
    ['application/atom+xml', '/atom.xml'],
    ['application/feed+json', '/feed.json'],
  ])
    await expect(page.locator(`link[rel="alternate"][type="${type}"]`)).toHaveAttribute(
      'href',
      href,
    )

  const ld = (await ldJson(page)).find((x) => x['@type'] === 'BlogPosting')!
  expect(ld).toBeTruthy()
  expect(ld).toMatchObject({
    headline: 'IA local no homelab, sem GPU e sem drama',
    inLanguage: 'pt-BR',
    author: { '@type': 'Person' },
  })
  // meta e OG saem da mesma síntese (cortada em ~160 caracteres pro snippet)
  const meta = (await page.locator('meta[name="description"]').getAttribute('content'))!
  const summary = String(ld.abstract)
  expect(summary.length).toBeGreaterThanOrEqual(160)
  expect(ld.description).toBe(summary)
  expect(summary.startsWith(meta.replace(/…$/, ''))).toBe(true)
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', meta)
  expect(String(ld.keywords)).toContain('Homelab')
  expect(ld.wordCount).toBeGreaterThan(100)
  expect(String(ld.timeRequired)).toMatch(/^PT\d+M$/)
  expect(Date.parse(String(ld.datePublished))).not.toBeNaN()
  expect(Date.parse(String(ld.dateModified))).not.toBeNaN()

  const link = page.locator('.summary__links a', { hasText: 'Ler em Markdown' })
  await setTheme(page, 'light')
  await page.reload()
  await settle(page)
  await link.scrollIntoViewIfNeeded()
  await page.evaluate(() => window.scrollBy(0, -120))
  await shot(page, 'p7-01-post-ler-em-markdown-desktop-claro')
  await setTheme(page, 'dark')
  await page.reload()
  await settle(page)
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await link.scrollIntoViewIfNeeded()
  await page.evaluate(() => window.scrollBy(0, -120))
  await shot(page, 'p7-02-post-ler-em-markdown-desktop-escuro')

  await link.click()
  await expect(page).toHaveURL(new RegExp(`/posts/${SLUG}\\.md$`))
  await expect(page.locator('body')).toContainText('key_points:')
  await shot(page, 'p7-03-post-md-desktop')
})

test('home: JSON-LD WebSite com busca', async ({ page }) => {
  await page.goto('/')
  const site = (await ldJson(page)).find((x) => x['@type'] === 'WebSite')!
  expect(site).toMatchObject({ name: 'Pronto, Falei!', inLanguage: 'pt-BR' })
  expect(JSON.stringify(site.potentialAction)).toContain('/busca?q={search_term_string}')
})

test('llms.txt e llms-full.txt', async ({ page, request }) => {
  const res = await request.get('/llms.txt')
  expect(res.headers()['content-type']).toBe('text/plain; charset=utf-8')
  const txt = await res.text()
  expect(txt).toMatch(/^# Pronto, Falei!\n\n> /)
  expect(txt).toContain('## Posts\n- [')
  expect(txt).toMatch(new RegExp(`\\]\\(https?://[^)]+/posts/${SLUG}\\.md\\): .{100,}`))
  expect(txt).toMatch(/\]\(https?:\/\/[^)]+\/sobre\.md\)/)
  expect(txt).toContain('/llms-full.txt')
  expect(txt).not.toContain('/posts/sem-capa')

  const full = await (await request.get('/llms-full.txt')).text()
  const posts = txt.match(/^- \[.+\]\(.+\/posts\/.+\.md\)/gm) ?? []
  expect(posts.length).toBeGreaterThanOrEqual(7)
  expect((full.match(/^title: /gm) ?? []).length).toBe(posts.length)
  expect(full).toContain('# IA local no homelab, sem GPU e sem drama')

  await page.setViewportSize(DESKTOP)
  await page.goto('/llms.txt')
  await shot(page, 'p7-04-llms-txt-desktop')
  await page.goto('/llms-full.txt')
  await shot(page, 'p7-05-llms-full-txt-desktop')
})

test('feeds: RSS, Atom e JSON Feed com síntese e texto completo', async ({ page, request }) => {
  const rss = await request.get('/rss.xml')
  expect(rss.headers()['content-type']).toBe('application/rss+xml; charset=utf-8')
  const xml = await rss.text()
  expect(xml).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>\n<rss version="2.0"/)
  const item = xml.split('<item>')[1]
  expect(item).toMatch(/<description>.{100,}<\/description>/)
  expect(item).toContain('<content:encoded><![CDATA[')
  expect(item).toMatch(/<h2>|<p>/)

  // o XML é válido pro parser do navegador
  await page.goto('/')
  const errors = await page.evaluate(async () => {
    const out: string[] = []
    for (const u of ['/rss.xml', '/atom.xml', '/sitemap.xml']) {
      const doc = new DOMParser().parseFromString(await (await fetch(u)).text(), 'application/xml')
      if (doc.getElementsByTagName('parsererror').length) out.push(u)
    }
    return out
  })
  expect(errors).toEqual([])

  const atom = await (await request.get('/atom.xml')).text()
  expect(atom).toContain('<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="pt-BR">')
  expect(atom).toMatch(/rel="alternate" type="text\/markdown" href="[^"]+\.md"/)

  const json = await (await request.get('/feed.json')).json()
  expect(json.version).toBe('https://jsonfeed.org/version/1.1')
  expect(json.items.length).toBeGreaterThanOrEqual(7)
  expect(json.items[0].summary.length).toBeGreaterThan(100)
  expect(json.items[0].content_html).toContain('<p>')

  const old = await request.get('/feed.xml', { maxRedirects: 0 })
  expect(old.status()).toBe(308)
  expect(new URL(old.headers().location, 'http://x').pathname).toBe('/rss.xml')

  await page.setViewportSize(DESKTOP)
  await page.goto('/rss.xml')
  await shot(page, 'p7-06-rss-xml-desktop')
  await page.goto('/feed.json')
  await shot(page, 'p7-07-feed-json-desktop')
})

test('robots.txt libera os robôs de IA e sitemap tem lastmod real', async ({ page, request }) => {
  const robots = await (await request.get('/robots.txt')).text()
  expect(robots).toContain('User-agent: *\nAllow: /\nDisallow: /admin')
  for (const bot of ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended', 'CCBot'])
    expect(robots).toContain(`User-agent: ${bot}\nAllow: /`)
  expect(robots).toMatch(/Sitemap: https?:\/\/\S+\/sitemap\.xml/)

  const sitemap = await (await request.get('/sitemap.xml')).text()
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>(?:<lastmod>([^<]+)<\/lastmod>)?/g)]
  const paths = urls.map((m) => new URL(m[1]).pathname)
  expect(paths).toEqual(
    expect.arrayContaining(['/', '/blog', '/sobre', `/posts/${SLUG}`, '/tags/homelab']),
  )
  expect(paths).not.toContain('/busca')
  const postMod = urls.find((m) => m[1].endsWith(`/posts/${SLUG}`))?.[2]
  expect(Date.parse(postMod!)).not.toBeNaN()

  await page.setViewportSize(DESKTOP)
  await page.goto('/robots.txt')
  await shot(page, 'p7-08-robots-txt-desktop')
  await page.goto('/sitemap.xml')
  await shot(page, 'p7-09-sitemap-xml-desktop')
})

test('publicar e despublicar atualiza .md, llms.txt e feeds na hora', async ({ page }) => {
  test.skip(!email || !password, 'defina E2E_EMAIL e E2E_PASSWORD')
  await page.setViewportSize(DESKTOP)
  await page.goto('/admin/login')
  await expect(page.locator('#field-email')).toBeVisible()
  await page.waitForLoadState('networkidle')
  await page.fill('#field-email', email!)
  await page.fill('#field-password', password!)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/\/admin\/?$/, { timeout: 30_000 })
  const origin = new URL(page.url()).origin
  const title = `Post das máquinas ${run}`

  // aquece os caches antes de publicar
  for (const u of ['/llms.txt', '/rss.xml', '/feed.json', '/sitemap.xml']) await page.request.get(u)

  const created = await page.request.post('/api/posts', {
    data: {
      title,
      _status: 'published',
      publishedAt: new Date().toISOString(),
      content: {
        root: {
          type: 'root',
          version: 1,
          direction: null,
          format: '',
          indent: 0,
          children: [
            {
              type: 'paragraph',
              version: 1,
              direction: null,
              format: '',
              indent: 0,
              textFormat: 0,
              children: [
                {
                  type: 'text',
                  version: 1,
                  text: `Corpo do teste ${run}.`,
                  format: 0,
                  detail: 0,
                  mode: 'normal',
                  style: '',
                },
              ],
            },
          ],
        },
      },
      summary: `Síntese do teste de ponta a ponta das máquinas, com texto suficiente pra passar na validação de tamanho mínimo da síntese. Ela precisa ter entre 160 e 400 caracteres, então vai mais uma frase ${run}.`,
      keyPoints: [{ text: 'Um' }, { text: 'Dois' }, { text: 'Três' }],
      summarySource: 'manual',
    },
    headers: { Origin: origin },
  })
  expect(created.status(), await created.text()).toBe(201)
  const doc = (await created.json()).doc
  const slug = doc.slug as string

  try {
    expect(await (await page.request.get('/llms.txt')).text()).toContain(`/posts/${slug}.md`)
    expect(await (await page.request.get('/rss.xml')).text()).toContain(title)
    expect(await (await page.request.get('/sitemap.xml')).text()).toContain(`/posts/${slug}<`)
    const md = await page.request.get(`/posts/${slug}.md`)
    expect(md.status()).toBe(200)
    expect(await md.text()).toContain(`Corpo do teste ${run}.`)
    expect((await (await page.request.get('/feed.json')).json()).items[0].title).toBe(title)

    const unpub = await page.request.patch(`/api/posts/${doc.id}`, {
      data: { _status: 'draft' },
      headers: { Origin: origin },
    })
    expect(unpub.status(), await unpub.text()).toBe(200)
    expect(await (await page.request.get('/llms.txt')).text()).not.toContain(slug)
    expect(await (await page.request.get('/llms-full.txt')).text()).not.toContain(title)
    expect(await (await page.request.get('/rss.xml')).text()).not.toContain(title)
    expect((await page.request.get(`/posts/${slug}.md`)).status()).toBe(404)
  } finally {
    await page.request.delete(`/api/posts/${doc.id}`, { headers: { Origin: origin } })
  }
})

test.describe('mobile', () => {
  test.use({ viewport: MOBILE, deviceScaleFactor: 2, isMobile: true, hasTouch: true })

  test('post com "Ler em Markdown" e o .md legíveis no celular', async ({ page }) => {
    await page.goto(`/posts/${SLUG}`)
    const link = page.locator('.summary__links a', { hasText: 'Ler em Markdown' })
    for (const theme of ['light', 'dark'] as const) {
      await setTheme(page, theme)
      await page.reload()
      await settle(page)
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
      await link.scrollIntoViewIfNeeded()
      await page.evaluate(() => window.scrollBy(0, -80))
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      )
      expect(overflow).toBeLessThanOrEqual(0)
      await shot(
        page,
        `p7-1${theme === 'light' ? 0 : 1}-post-mobile-${theme === 'light' ? 'claro' : 'escuro'}`,
      )
    }
    await link.tap()
    await expect(page).toHaveURL(new RegExp(`/posts/${SLUG}\\.md$`))
    await expect(page.locator('body')).toContainText('# IA local no homelab')
    await shot(page, 'p7-12-post-md-mobile')
    await page.goto('/llms.txt')
    await shot(page, 'p7-13-llms-txt-mobile')
  })
})
