import type { AdminViewServerProps } from 'payload'

import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import { redirect } from 'next/navigation'
import React from 'react'

import { ModerationPanel } from './ModerationPanel'

/** /admin/comentarios — moderação do Remark42 com o login do blog. */
export function ComentariosView({ initPageResult, params, searchParams }: AdminViewServerProps) {
  const { req, permissions, locale, visibleEntities } = initPageResult
  if (!req.user) redirect(`${req.payload.config.routes.admin}/login`)
  return (
    <DefaultTemplate
      i18n={req.i18n}
      locale={locale}
      params={params}
      payload={req.payload}
      permissions={permissions}
      req={req}
      searchParams={searchParams}
      user={req.user}
      visibleEntities={visibleEntities}
    >
      <Gutter>
        <h1>Comentários</h1>
        <p>
          Últimos 50 comentários do Remark42. Apagar remove o comentário; bloquear esconde todos os
          comentários da pessoa e impede novos.
        </p>
        <ModerationPanel />
      </Gutter>
    </DefaultTemplate>
  )
}
