import fs from 'node:fs'

import { expect, test } from '@playwright/test'

/**
 * Analytics self-hosted (passo 11): Umami atrás do /stats do próprio app.
 * Precisa da stack com o perfil `stats`, do scripts/setup-umami.py e de
 * E2E_UMAMI_URL (painel, ex.: http://127.0.0.1:3133) + E2E_UMAMI_SECRET_FILE.
 */
const umamiUrl = process.env.E2E_UMAMI_URL
const secretFile = process.env.E2E_UMAMI_SECRET_FILE
const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'

test.skip(!umamiUrl || !secretFile, 'defina E2E_UMAMI_URL e E2E_UMAMI_SECRET_FILE')

async function umamiToken(request: import('@playwright/test').APIRequestContext) {
  const cred = Object.fromEntries(
    fs
      .readFileSync(secretFile!, 'utf8')
      .split('\n')
      .filter((l) => l.includes('='))
      .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
  )
  const res = await request.post(`${umamiUrl}/api/auth/login`, {
    data: { username: cred.usuario, password: cred.senha },
  })
  expect(res.ok()).toBe(true)
  return (await res.json()).token as string
}

test('tracker leve no próprio domínio, sem cookies, contando pageview', async ({
  browser,
  baseURL,
  request,
}) => {
  const ctx = await browser.newContext({ userAgent: UA })
  const page = await ctx.newPage()
  const sent = page.waitForResponse(
    (r) => r.url().endsWith('/stats/api/send') && r.request().method() === 'POST',
  )
  await page.goto('/blog')
  const tag = page.locator('script[src="/stats/script.js"]')
  const websiteId = await tag.getAttribute('data-website-id')
  expect(websiteId).toMatch(/^[0-9a-f-]{36}$/)
  await expect(tag).toHaveAttribute('data-do-not-track', 'true')
  await expect(tag).toHaveAttribute('data-domains', new URL(baseURL!).hostname)
  const res = await sent
  expect(res.status()).toBe(200)
  // nenhum cookie de analytics
  expect((await ctx.cookies()).filter((c) => /umami/i.test(c.name))).toEqual([])
  await ctx.close()

  // o pageview chegou no Umami
  const token = await umamiToken(request)
  const end = Date.now() + 60_000
  await expect
    .poll(
      async () => {
        const r = await request.get(
          `${umamiUrl}/api/websites/${websiteId}/stats?startAt=${end - 3_600_000}&endAt=${end}`,
          { headers: { Authorization: `Bearer ${token}` } },
        )
        const s = await r.json()
        return typeof s.pageviews === 'object' ? s.pageviews.value : s.pageviews
      },
      { timeout: 15_000 },
    )
    .toBeGreaterThan(0)
})

test('com Do Not Track ligado, nada é enviado', async ({ browser }) => {
  const ctx = await browser.newContext({ userAgent: UA })
  await ctx.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'doNotTrack', { get: () => '1' })
  })
  const page = await ctx.newPage()
  let sends = 0
  page.on('request', (r) => {
    if (r.url().endsWith('/stats/api/send')) sends++
  })
  await page.goto('/blog')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1500)
  expect(sends).toBe(0)
  await ctx.close()
})

test('o painel do Umami não fica exposto pelo site', async ({ request }) => {
  for (const path of ['/stats', '/stats/login', '/stats/api/auth/login', '/stats/api/websites']) {
    const r = await request.get(path, { maxRedirects: 0 })
    expect(r.status(), path).toBe(404)
  }
  const script = await request.get('/stats/script.js')
  expect(script.status()).toBe(200)
  expect(script.headers()['content-type']).toContain('javascript')
})
