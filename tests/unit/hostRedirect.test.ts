import { describe, expect, it } from 'vitest'

import { canonicalRedirect, redirectHosts, requestHost } from '@/lib/hostRedirect'

const env = {
  NEXT_PUBLIC_SERVER_URL: 'https://wilsonlima.dev',
  CANONICAL_REDIRECT_HOSTS: ' www.wilsonlima.dev , WWW.Outro.dev ',
}

describe('redirecionamento pro host canônico', () => {
  it('lê a lista do env, sem espaços e em minúsculas', () => {
    expect(redirectHosts(env)).toEqual(['www.wilsonlima.dev', 'www.outro.dev'])
    expect(redirectHosts({})).toEqual([])
  })

  it('www vai pro apex mantendo caminho e query', () => {
    expect(canonicalRedirect('www.wilsonlima.dev', '/posts/x?y=1', env)).toBe(
      'https://wilsonlima.dev/posts/x?y=1',
    )
    expect(canonicalRedirect('www.wilsonlima.dev', '/', env)).toBe('https://wilsonlima.dev/')
  })

  it('Tailscale, LAN, localhost e o próprio apex não redirecionam', () => {
    for (const h of ['umbrel-1.tail3bbeb5.ts.net', '192.168.1.18', 'localhost', 'wilsonlima.dev']) {
      expect(canonicalRedirect(h, '/admin', env)).toBeNull()
    }
  })

  it('sem lista, sem URL pública ou URL inválida: não faz nada', () => {
    expect(
      canonicalRedirect('www.wilsonlima.dev', '/', {
        NEXT_PUBLIC_SERVER_URL: 'https://wilsonlima.dev',
      }),
    ).toBeNull()
    expect(
      canonicalRedirect('www.wilsonlima.dev', '/', {
        CANONICAL_REDIRECT_HOSTS: 'www.wilsonlima.dev',
      }),
    ).toBeNull()
    expect(
      canonicalRedirect('www.wilsonlima.dev', '/', { ...env, NEXT_PUBLIC_SERVER_URL: 'nada' }),
    ).toBeNull()
  })

  it('não entra em loop se a URL pública já for o host listado', () => {
    expect(
      canonicalRedirect('www.wilsonlima.dev', '/', {
        ...env,
        NEXT_PUBLIC_SERVER_URL: 'https://www.wilsonlima.dev',
      }),
    ).toBeNull()
  })

  it('host da requisição: x-forwarded-host primeiro, sem porta', () => {
    expect(requestHost(new Headers({ host: 'WWW.wilsonlima.dev:443' }))).toBe('www.wilsonlima.dev')
    expect(
      requestHost(
        new Headers({ host: 'umbrel.local:3130', 'x-forwarded-host': 'www.wilsonlima.dev' }),
      ),
    ).toBe('www.wilsonlima.dev')
    expect(requestHost(new Headers())).toBe('')
  })
})
