import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import React from 'react'

import { NewsletterForm } from '@/components/site/NewsletterForm'
import { newsletterEnabled } from '@/lib/newsletter'
import { pageMeta } from '@/lib/pageMeta'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Newsletter',
  description:
    'Receba os textos novos do Pronto, Falei! por e-mail. Confirmação dupla, sem rastreio.',
  ...pageMeta('/newsletter', { title: 'Newsletter · Pronto, Falei!' }),
}

export default function NewsletterPage() {
  if (!newsletterEnabled()) notFound()
  return (
    <div className="container container--narrow newsletter newsletter--page">
      <header className="page-head">
        <p className="eyebrow">Newsletter</p>
        <h1>Os textos novos, no seu e-mail</h1>
        <p className="newsletter__lead">
          Quando sai texto novo, mando um e-mail curto com o link. Sem spam, sem pixel de rastreio e
          sem vender seu endereço pra ninguém.
        </p>
      </header>
      <NewsletterForm />
    </div>
  )
}
