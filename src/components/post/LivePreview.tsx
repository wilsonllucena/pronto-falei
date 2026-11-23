'use client'

import { RefreshRouteOnSave } from '@payloadcms/live-preview-react'
import { useRouter } from 'next/navigation'
import React, { useSyncExternalStore } from 'react'

const noop = () => () => {}

/**
 * Live preview do admin: a cada autosave o Payload avisa o iframe e a página
 * recarrega os dados do rascunho. Usa a origem atual (LAN, Tailscale ou domínio).
 */
export function LivePreview() {
  const router = useRouter()
  const origin = useSyncExternalStore(
    noop,
    () => window.location.origin,
    () => '',
  )
  if (!origin) return null
  return <RefreshRouteOnSave refresh={() => router.refresh()} serverURL={origin} />
}
