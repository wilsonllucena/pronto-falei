import type { Endpoint } from 'payload'

import { runHealthChecks } from '../lib/health'
import { bucketExists } from '../lib/storage'

type MongoLikeDb = {
  connection?: { db?: { admin: () => { ping: () => Promise<{ ok?: number }> } } }
}

/** GET /api/health — 200 só se o Mongo responde ao ping e o bucket do MinIO existe. */
export const healthEndpoint: Endpoint = {
  path: '/health',
  method: 'get',
  handler: async (req) => {
    const db = req.payload.db as unknown as MongoLikeDb
    const result = await runHealthChecks({
      mongo: async () => {
        const res = await db.connection?.db?.admin().ping()
        return res?.ok === 1
      },
      bucket: () => bucketExists(),
    })
    return Response.json(result, {
      status: result.status === 'ok' ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    })
  },
}
