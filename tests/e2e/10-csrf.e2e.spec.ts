import { expect, test } from '@playwright/test'

/**
 * CSRF/CORS do Payload restritos às origens configuradas
 * (PAYLOAD_ALLOWED_ORIGINS; em dev/CI, a origem da URL pública).
 */
const email = process.env.E2E_EMAIL
const password = process.env.E2E_PASSWORD

test('cookie de login só vale com Origin permitido; CORS idem', async ({ playwright, baseURL }) => {
  test.skip(!email || !password, 'defina E2E_EMAIL e E2E_PASSWORD')
  const good = new URL(baseURL!).origin
  const evil = 'https://malicioso.exemplo'
  const ctx = await playwright.request.newContext({ baseURL })
  const login = await ctx.post('/api/users/login', {
    data: { email, password },
    headers: { Origin: good },
  })
  expect(login.ok()).toBe(true)

  const meGood = await ctx.get('/api/users/me', { headers: { Origin: good } })
  expect((await meGood.json()).user?.email).toBe(email)
  expect(meGood.headers()['access-control-allow-origin']).toBe(good)

  const meEvil = await ctx.get('/api/users/me', { headers: { Origin: evil } })
  expect((await meEvil.json()).user ?? null).toBeNull()
  expect(meEvil.headers()['access-control-allow-origin']).not.toBe(evil)

  // escrita cross-site com o cookie é recusada
  const write = await ctx.post('/api/tags', {
    data: { name: 'csrf-nao-pode' },
    headers: { Origin: evil },
  })
  expect([401, 403]).toContain(write.status())
  await ctx.dispose()
})
