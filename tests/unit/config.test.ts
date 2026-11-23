import { describe, expect, it } from 'vitest'

import { Media } from '@/collections/Media'
import { Users } from '@/collections/Users'
import { healthEndpoint } from '@/endpoints/health'

describe('collections do esqueleto', () => {
  it('Users usa auth e é a collection do admin', () => {
    expect(Users.slug).toBe('users')
    expect(Users.auth).toBe(true)
  })

  it('Media é upload só de imagem e exige alt', () => {
    expect(Media.slug).toBe('media')
    expect(Media.upload).toMatchObject({ mimeTypes: ['image/*'] })
    const alt = Media.fields.find((f) => 'name' in f && f.name === 'alt')
    expect(alt).toMatchObject({ type: 'text', required: true })
  })

  it('health responde em GET /health', () => {
    expect(healthEndpoint).toMatchObject({ path: '/health', method: 'get' })
  })
})
