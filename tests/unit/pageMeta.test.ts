import { describe, expect, it } from 'vitest'

import { pageMeta } from '@/lib/pageMeta'

describe('pageMeta', () => {
  it('canônico e og:url com o mesmo caminho relativo', () => {
    const m = pageMeta('/blog')
    expect(m.alternates?.canonical).toBe('/blog')
    expect(m.openGraph).toMatchObject({ url: '/blog', type: 'website', siteName: 'Pronto, Falei!' })
  })
  it('aceita sobrescrever campos do Open Graph', () => {
    expect(pageMeta('/sobre', { type: 'profile' }).openGraph).toMatchObject({
      url: '/sobre',
      type: 'profile',
    })
  })
})
