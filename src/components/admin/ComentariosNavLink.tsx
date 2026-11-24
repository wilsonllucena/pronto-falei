'use client'

import { useConfig } from '@payloadcms/ui'
import Link from 'next/link'
import React from 'react'

/** Link "Comentários" no menu do admin (moderação do Remark42). */
export function ComentariosNavLink() {
  const {
    config: {
      routes: { admin },
    },
  } = useConfig()
  return (
    <Link className="nav__link comentarios-nav-link" href={`${admin}/comentarios`}>
      <span className="nav__link-label">Comentários</span>
    </Link>
  )
}
