import { describe, expect, it } from 'vitest'

import { runHealthChecks } from '@/lib/health'

describe('runHealthChecks', () => {
  it('fica ok quando todos os checks passam', async () => {
    const result = await runHealthChecks({ mongo: async () => true })
    expect(result).toEqual({ status: 'ok', checks: { mongo: 'ok' } })
  })

  it('marca erro quando um check retorna false', async () => {
    const result = await runHealthChecks({ mongo: async () => true, bucket: async () => false })
    expect(result.status).toBe('error')
    expect(result.checks).toEqual({ mongo: 'ok', bucket: 'error' })
  })

  it('marca erro quando um check lança exceção', async () => {
    const result = await runHealthChecks({
      mongo: async () => {
        throw new Error('sem conexão')
      },
    })
    expect(result).toEqual({ status: 'error', checks: { mongo: 'error' } })
  })

  it('sem checks não é considerado saudável', async () => {
    const result = await runHealthChecks({})
    expect(result.status).toBe('error')
  })
})
