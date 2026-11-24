import { expect, test } from '@playwright/test'

/**
 * Host alternativo (www) redireciona 308 pro host canônico da URL pública,
 * mantendo caminho e query; os outros hosts (Tailscale, LAN) seguem normais.
 * Precisa de CANONICAL_REDIRECT_HOSTS no app e E2E_REDIRECT_HOST no teste.
 */
const host = process.env.E2E_REDIRECT_HOST

test('www redireciona 308 pro host canônico e o resto segue normal', async ({ request }) => {
  test.skip(!host, 'defina E2E_REDIRECT_HOST (e CANONICAL_REDIRECT_HOSTS no app)')
  const res = await request.get('/posts/x?ref=1', {
    headers: { 'x-forwarded-host': host! },
    maxRedirects: 0,
  })
  expect(res.status()).toBe(308)
  const to = new URL(res.headers()['location'])
  expect(to.hostname).not.toBe(host)
  expect(`${to.pathname}${to.search}`).toBe('/posts/x?ref=1')

  const api = await request.get('/api/health', {
    headers: { 'x-forwarded-host': host! },
    maxRedirects: 0,
  })
  expect(api.status()).toBe(308)

  const normal = await request.get('/api/health', { maxRedirects: 0 })
  expect(normal.status()).toBe(200)
})

test('listagens têm canônico e og:url absolutos na URL pública', async ({ page }) => {
  for (const path of ['/', '/blog', '/tags', '/sobre']) {
    await page.goto(path)
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href')
    const og = await page.locator('meta[property="og:url"]').getAttribute('content')
    expect(canonical, path).toMatch(/^https?:\/\//)
    expect(new URL(canonical!).pathname, path).toBe(path)
    expect(og, path).toBe(canonical)
  }
})
