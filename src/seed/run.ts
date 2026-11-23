// pnpm seed — popula o banco LOCAL de desenvolvimento. Nunca rode em produção.
import config from '@payload-config'
import { getPayload } from 'payload'

import { seed } from './seed'

const payload = await getPayload({ config })
try {
  const { created } = await seed(payload)
  payload.logger.info(
    created.length ? `Seed criou: ${created.join(', ')}` : 'Seed: nada novo a criar',
  )
} finally {
  await payload.destroy()
}
process.exit(0)
