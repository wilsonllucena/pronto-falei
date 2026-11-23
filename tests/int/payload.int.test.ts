import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'

let payload: Payload
const email = `int-${Date.now()}@pronto-falei.local`

describe('Payload + MongoDB (replica set)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  afterAll(async () => {
    await payload.delete({ collection: 'users', where: { email: { equals: email } } })
    await payload.destroy()
  })

  it('o Mongo responde ao ping', async () => {
    const db = payload.db as unknown as {
      connection: { db: { admin: () => { ping: () => Promise<{ ok: number }> } } }
    }
    const res = await db.connection.db.admin().ping()
    expect(res.ok).toBe(1)
  })

  it('o Mongo é um replica set (necessário pra transações)', async () => {
    const db = payload.db as unknown as {
      connection: { db: { admin: () => { command: (c: object) => Promise<{ setName?: string }> } } }
    }
    const hello = await db.connection.db.admin().command({ hello: 1 })
    expect(hello.setName).toBe('rs0')
  })

  it('suporta transações', async () => {
    const transactionID = await payload.db.beginTransaction()
    expect(transactionID).toBeTruthy()
    await payload.db.rollbackTransaction(transactionID!)
  })

  it('cria e lê um usuário', async () => {
    await payload.create({
      collection: 'users',
      data: { email, password: `pw-${Math.random().toString(36).slice(2)}`, name: 'Teste' },
    })
    const found = await payload.find({ collection: 'users', where: { email: { equals: email } } })
    expect(found.totalDocs).toBe(1)
    expect(found.docs[0]?.name).toBe('Teste')
  })
})
