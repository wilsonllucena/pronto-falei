import { describe, expect, it } from 'vitest'

import { allowedOrigins } from '@/lib/origins'

describe('allowedOrigins', () => {
  it('usa a lista do env, normalizada pra origem e sem repetidos', () => {
    expect(
      allowedOrigins({
        PAYLOAD_ALLOWED_ORIGINS:
          ' https://blog.exemplo/ , http://host.tailnet:3130/admin,http://10.0.0.2:3130,https://blog.exemplo',
        NEXT_PUBLIC_SERVER_URL: 'https://outro.exemplo',
      }),
    ).toEqual(['https://blog.exemplo', 'http://host.tailnet:3130', 'http://10.0.0.2:3130'])
  })
  it('ignora valores inválidos ou de outro protocolo', () => {
    expect(
      allowedOrigins({ PAYLOAD_ALLOWED_ORIGINS: 'nada, ftp://x.exemplo, https://ok.exemplo' }),
    ).toEqual(['https://ok.exemplo'])
  })
  it('sem lista, cai na origem da URL pública', () => {
    expect(allowedOrigins({ NEXT_PUBLIC_SERVER_URL: 'http://localhost:3130/' })).toEqual([
      'http://localhost:3130',
    ])
  })
  it('sem nada configurado, lista vazia', () => {
    expect(allowedOrigins({})).toEqual([])
  })
})
