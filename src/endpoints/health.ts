import type { Endpoint } from 'payload'

import { runHealthChecks } from '../lib/health'

type MongoLikeDb = {
  connection?: { db?: { admin: () => { ping: () => Promise<{ ok?: number }> } } }
}

/** GET /api/health — 200 se o Mongo responde ao ping, 503 caso contrário. */
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
    })
    return Response.json(result, {
      status: result.status === 'ok' ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    })
  },
}
