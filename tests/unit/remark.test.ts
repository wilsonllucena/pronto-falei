import { describe, expect, it } from 'vitest'

import {
  adminAuthHeader,
  filterCookies,
  moderationCall,
  parseModeration,
  remarkRequestHeaders,
  remarkSiteId,
  remarkTarget,
  remarkUpstream,
  toRecent,
} from '@/lib/remark'

const ENV = { REMARK_INTERNAL_URL: 'http://remark42:8080/', REMARK_SITE_ID: 'pronto-falei' }

describe('remark42: proxy de caminho', () => {
  it('sem URL interna, comentários ficam desligados', () => {
    expect(remarkUpstream({})).toBeNull()
    expect(remarkUpstream({ REMARK_INTERNAL_URL: 'ftp://x' })).toBeNull()
    expect(remarkSiteId({ REMARK_SITE_ID: 'pronto-falei' })).toBeNull()
    expect(remarkTarget('/comentarios/web/embed.mjs', '', {})).toBeNull()
  })
  it('site id inválido não liga o widget', () => {
    expect(remarkSiteId(ENV)).toBe('pronto-falei')
    expect(remarkSiteId({ ...ENV, REMARK_SITE_ID: 'x"><script>' })).toBeNull()
    expect(remarkSiteId({ ...ENV, REMARK_SITE_ID: '' })).toBeNull()
  })
  it('reescreve só o prefixo /comentarios, preservando a query', () => {
    expect(remarkTarget('/comentarios/api/v1/find', '?site=a&url=b', ENV)).toBe(
      'http://remark42:8080/api/v1/find?site=a&url=b',
    )
    expect(remarkTarget('/comentarios', '', ENV)).toBe('http://remark42:8080/')
    expect(remarkTarget('/comentariosx', '', ENV)).toBeNull()
    expect(remarkTarget('/posts/a', '', ENV)).toBeNull()
    expect(remarkTarget('/comentarios/../admin', '', ENV)).toBeNull()
  })
  it('só os cookies do Remark42 seguem (login do admin do blog não vaza)', () => {
    expect(filterCookies('payload-token=abc; JWT=j; theme=dark; XSRF-TOKEN=x')).toBe(
      'JWT=j; XSRF-TOKEN=x',
    )
    expect(filterCookies('payload-token=abc')).toBe('')
    expect(filterCookies(null)).toBe('')
  })
  it('cabeçalhos: tira Authorization e cookies alheios, passa o IP real', () => {
    const h = remarkRequestHeaders(
      new Headers({
        cookie: 'payload-token=abc; JWT=j',
        authorization: 'Basic YWRtaW46eA==',
        'cf-connecting-ip': '203.0.113.9',
        'x-forwarded-for': '172.29.130.1',
        accept: 'application/json',
      }),
    )
    expect(h.get('cookie')).toBe('JWT=j')
    expect(h.get('authorization')).toBeNull()
    expect(h.get('x-real-ip')).toBe('203.0.113.9')
    expect(h.get('x-forwarded-for')).toBe('203.0.113.9')
    expect(h.get('accept')).toBe('application/json')
    const semCookie = remarkRequestHeaders(
      new Headers({ cookie: 'payload-token=abc', 'x-forwarded-for': '1.2.3.4, 10.0.0.1' }),
    )
    expect(semCookie.get('cookie')).toBeNull()
    expect(semCookie.get('x-real-ip')).toBe('1.2.3.4')
  })
})

describe('remark42: moderação', () => {
  it('valida o pedido', () => {
    expect(parseModeration({ action: 'apagar', id: 'c-1', url: 'https://blog/posts/a' })).toEqual({
      action: 'apagar',
      id: 'c-1',
      url: 'https://blog/posts/a',
    })
    expect(parseModeration({ action: 'apagar', id: 'c-1', url: 'javascript:x' })).toBeNull()
    expect(parseModeration({ action: 'apagar', id: '../x', url: 'https://b/p' })).toBeNull()
    expect(parseModeration({ action: 'bloquear', userId: 'anonymous_abc' })).toEqual({
      action: 'bloquear',
      userId: 'anonymous_abc',
    })
    expect(parseModeration({ action: 'promover', userId: 'x' })).toBeNull()
    expect(parseModeration(null)).toBeNull()
  })
  it('monta a chamada de admin do Remark42', () => {
    expect(moderationCall({ action: 'apagar', id: 'c1', url: 'https://b/p?a=1' }, 'pf')).toEqual({
      method: 'DELETE',
      path: '/api/v1/admin/comment/c1?site=pf&url=https%3A%2F%2Fb%2Fp%3Fa%3D1',
    })
    expect(moderationCall({ action: 'bloquear', userId: 'anonymous_x' }, 'pf')).toEqual({
      method: 'PUT',
      path: '/api/v1/admin/user/anonymous_x?site=pf&block=1',
    })
    expect(moderationCall({ action: 'desbloquear', userId: 'anonymous_x' }, 'pf').path).toContain(
      'block=0',
    )
  })
  it('resume comentários sem IP e ignora apagados', () => {
    const out = toRecent([
      {
        id: 'a',
        text: '<p>oi</p>',
        orig: 'oi',
        time: 't',
        locator: { url: 'https://b/p' },
        user: { id: 'u', name: 'Ana', ip: 'segredo' },
      },
      { id: 'b', delete: true },
      'lixo',
    ])
    expect(out).toEqual([
      { id: 'a', text: 'oi', url: 'https://b/p', time: 't', user: { id: 'u', name: 'Ana' } },
    ])
    expect(toRecent(null)).toEqual([])
  })
  it('basic auth do admin só com senha configurada', () => {
    expect(adminAuthHeader({})).toBeNull()
    expect(adminAuthHeader({ REMARK_ADMIN_PASSWD: 'p' })).toBe(
      `Basic ${Buffer.from('admin:p').toString('base64')}`,
    )
  })
})
