import { describe, expect, it } from 'vitest'

import {
  clientIp,
  createLimiter,
  listmonkRequestHeaders,
  listmonkTarget,
  listmonkUpstream,
  newsletterConfig,
  parseSubscription,
} from '@/lib/newsletter'

const UUID = '42a729cf-d8e2-4191-8428-71f9ed95693e'
const ENV = {
  LISTMONK_INTERNAL_URL: 'http://listmonk:9000/',
  LISTMONK_LIST_UUID: UUID,
  NEWSLETTER_ENABLED: 'true',
}

describe('newsletter: configuração', () => {
  it('formulário só com Listmonk, lista válida e SMTP (NEWSLETTER_ENABLED)', () => {
    expect(newsletterConfig(ENV)).toEqual({ upstream: 'http://listmonk:9000', listUuid: UUID })
    expect(newsletterConfig({ ...ENV, NEWSLETTER_ENABLED: '' })).toBeNull()
    expect(newsletterConfig({ ...ENV, LISTMONK_LIST_UUID: 'x' })).toBeNull()
    expect(newsletterConfig({ ...ENV, LISTMONK_INTERNAL_URL: '' })).toBeNull()
    expect(listmonkUpstream({ LISTMONK_INTERNAL_URL: 'ftp://x' })).toBeNull()
  })
})

describe('newsletter: proxy de caminho', () => {
  it('repassa só as páginas públicas (confirmar, sair, arquivos)', () => {
    expect(listmonkTarget('/newsletter/subscription/optin/abc', '?l=1', ENV)).toBe(
      'http://listmonk:9000/subscription/optin/abc?l=1',
    )
    expect(listmonkTarget('/newsletter/subscription/c/s', '?manage=true', ENV)).toBe(
      'http://listmonk:9000/subscription/c/s?manage=true',
    )
    expect(listmonkTarget('/public/static/style.css', '?v=1', ENV)).toBe(
      'http://listmonk:9000/public/static/style.css?v=1',
    )
    expect(listmonkTarget('/public/custom.css', '', ENV)).toBe(
      'http://listmonk:9000/public/custom.css',
    )
  })
  it('admin, API, formulário do Listmonk e o resto ficam de fora', () => {
    for (const p of [
      '/newsletter',
      '/newsletter/admin',
      '/newsletter/api/lists',
      '/newsletter/api/public/subscription',
      '/newsletter/subscription/form',
      '/public/uploads/x.png',
      '/public/custom.cssx',
      '/newsletter/subscription/../admin',
      '/admin',
    ]) {
      expect(listmonkTarget(p, '', ENV), p).toBeNull()
    }
    expect(listmonkTarget('/newsletter/subscription/x', '', {})).toBeNull()
  })
  it('sem cookies nem Authorization do blog; IP real do visitante', () => {
    const h = listmonkRequestHeaders(
      new Headers({
        cookie: 'payload-token=abc',
        authorization: 'Bearer x',
        'cf-connecting-ip': '203.0.113.7',
        accept: 'text/html',
      }),
    )
    expect(h.get('cookie')).toBeNull()
    expect(h.get('authorization')).toBeNull()
    expect(h.get('x-forwarded-for')).toBe('203.0.113.7')
    expect(h.get('accept')).toBe('text/html')
    expect(clientIp(new Headers({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' }))).toBe('1.2.3.4')
    expect(clientIp(new Headers())).toBe('')
  })
})

describe('newsletter: inscrição', () => {
  it('valida e normaliza o e-mail; isca marca robô', () => {
    expect(parseSubscription({ email: ' Ana@Exemplo.com ' })).toEqual({
      email: 'ana@exemplo.com',
      spam: false,
    })
    expect(parseSubscription({ email: 'ana@exemplo.com', website: 'http://x' })?.spam).toBe(true)
    for (const bad of [
      '',
      'ana',
      'ana@',
      'a b@c.com',
      'ana@exemplo',
      '<a@b.com>',
      `${'a'.repeat(250)}@b.com`,
    ])
      expect(parseSubscription({ email: bad }), bad).toBeNull()
    expect(parseSubscription(null)).toBeNull()
    expect(parseSubscription({ email: 3 })).toBeNull()
  })
  it('limite por chave dentro da janela', () => {
    const lim = createLimiter(2, 1000)
    expect(lim.allow('ip', 0)).toBe(true)
    expect(lim.allow('ip', 10)).toBe(true)
    expect(lim.allow('ip', 20)).toBe(false)
    expect(lim.allow('outro', 20)).toBe(true)
    expect(lim.allow('ip', 1015)).toBe(true)
  })
})
