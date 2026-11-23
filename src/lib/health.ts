export type HealthCheck = () => Promise<boolean>

export type HealthResult = {
  status: 'ok' | 'error'
  checks: Record<string, 'ok' | 'error'>
}

/**
 * Roda todos os checks em paralelo. Qualquer falha (false ou exceção) marca o
 * serviço como "error". No passo 3 entra o check do bucket do MinIO.
 */
export async function runHealthChecks(checks: Record<string, HealthCheck>): Promise<HealthResult> {
  const entries = await Promise.all(
    Object.entries(checks).map(async ([name, check]) => {
      try {
        return [name, (await check()) ? 'ok' : 'error'] as const
      } catch {
        return [name, 'error'] as const
      }
    }),
  )
  const result = Object.fromEntries(entries) as HealthResult['checks']
  const allOk = entries.length > 0 && entries.every(([, value]) => value === 'ok')
  return { status: allOk ? 'ok' : 'error', checks: result }
}
