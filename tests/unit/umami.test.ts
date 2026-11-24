import { describe, expect, it } from 'vitest'

import { forwardHeaders, trackerConfig, umamiUpstream } from '@/lib/umami'

const ID = '0f7c2a4e-9d1b-4c3a-8e5f-123456789abc'

describe('umami', () => {
  it('sem URL interna ou sem website id válido, não injeta o tracker', () => {
    expect(trackerConfig({ UMAMI_WEBSITE_ID: ID })).toBeNull()
    expect(trackerConfig({ UMAMI_INTERNAL_URL: 'http://umami:3000' })).toBeNull()
    expect(
      trackerConfig({ UMAMI_INTERNAL_URL: 'http://umami:3000', UMAMI_WEBSITE_ID: 'x"><script>' }),
    ).toBeNull()
  })
  it('domínio padrão é o host da URL pública; DNT ligado por padrão', () => {
    expect(
      trackerConfig({
        UMAMI_INTERNAL_URL: 'http://umami:3000',
        UMAMI_WEBSITE_ID: ID,
        NEXT_PUBLIC_SERVER_URL: 'https://blog.exemplo/',
      }),
    ).toEqual({ websiteId: ID, domains: 'blog.exemplo', doNotTrack: true })
  })
  it('UMAMI_DOMAINS vazio (compose) cai no host da URL pública', () => {
    expect(
      trackerConfig({
        UMAMI_INTERNAL_URL: 'http://umami:3000',
        UMAMI_WEBSITE_ID: ID,
        UMAMI_DOMAINS: '',
        NEXT_PUBLIC_SERVER_URL: 'http://localhost:3130',
      })?.domains,
    ).toBe('localhost')
  })
  it('UMAMI_DOMAINS e UMAMI_RESPECT_DNT=false sobrescrevem', () => {
    expect(
      trackerConfig({
        UMAMI_INTERNAL_URL: 'http://umami:3000',
        UMAMI_WEBSITE_ID: ID,
        UMAMI_DOMAINS: ' A.exemplo , b.exemplo ',
        UMAMI_RESPECT_DNT: 'false',
      }),
    ).toEqual({ websiteId: ID, domains: 'a.exemplo,b.exemplo', doNotTrack: false })
  })
  it('normaliza a URL interna e recusa protocolos estranhos', () => {
    expect(umamiUpstream({ UMAMI_INTERNAL_URL: 'http://umami:3000/' })).toBe('http://umami:3000')
    expect(umamiUpstream({ UMAMI_INTERNAL_URL: 'file:///etc' })).toBeNull()
    expect(umamiUpstream({})).toBeNull()
  })
  it('repassa só os cabeçalhos que o Umami usa (nunca cookie/authorization)', () => {
    const h = forwardHeaders(
      new Headers({
        'user-agent': 'UA',
        'cf-connecting-ip': '203.0.113.9',
        cookie: 'payload-token=segredo',
        authorization: 'JWT x',
        'x-umami-cache': 'c',
      }),
    )
    expect(Object.fromEntries(h.entries())).toEqual({
      'user-agent': 'UA',
      'cf-connecting-ip': '203.0.113.9',
      'x-umami-cache': 'c',
    })
  })
})
