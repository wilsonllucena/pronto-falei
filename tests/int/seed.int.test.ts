import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { seed } from '@/seed/seed'

let payload: Payload

describe('seed de desenvolvimento', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })
  afterAll(async () => {
    await payload.destroy()
  })

  it('é idempotente e cria categorias, tags, Sobre e post publicado', async () => {
    await seed(payload)
    const second = await seed(payload)
    expect(second.created).toEqual([])

    const cats = await payload.find({
      collection: 'categories',
      where: { slug: { in: ['opiniao', 'tutorial', 'diario'] } },
    })
    expect(cats.totalDocs).toBe(3)
    const post = await payload.find({
      collection: 'posts',
      where: { slug: { equals: 'ola-mundo-pronto-falei' } },
    })
    expect(post.docs[0]?._status).toBe('published')
    expect(post.docs[0]?.readingTime).toBeGreaterThan(0)
  })
})
