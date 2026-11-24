import React from 'react'

import { NewsletterForm } from './NewsletterForm'

/** Chamada pra newsletter no fim do post (só aparece com a newsletter ligada). */
export function NewsletterBox() {
  return (
    <section
      className="newsletter newsletter--box"
      id="newsletter"
      aria-labelledby="newsletter-titulo"
    >
      <h2 id="newsletter-titulo" className="newsletter__title">
        Assine a newsletter
      </h2>
      <p className="newsletter__lead">
        Texto novo do Pronto, Falei! direto no seu e-mail. Sem spam, sem rastreio.
      </p>
      <NewsletterForm compact />
    </section>
  )
}
