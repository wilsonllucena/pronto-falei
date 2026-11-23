import React from 'react'

import type { Segment } from '@/lib/search'

/** Texto com os termos da busca marcados em <mark>. */
export function Highlighted({ segments }: { segments: Segment[] }) {
  return (
    <>
      {segments.map((s, i) =>
        s.hit ? <mark key={i}>{s.text}</mark> : <React.Fragment key={i}>{s.text}</React.Fragment>,
      )}
    </>
  )
}
