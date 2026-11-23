import React from 'react'

/**
 * Home provisória do passo 1 (esqueleto). O layout de verdade (header,
 * destaques, lista por mês, temas claro/escuro) chega no passo 4.
 */
export default function HomePage() {
  return (
    <div className="home">
      <h1 className="wordmark">
        Pronto, <span className="accent">Falei!</span>
      </h1>
      <p className="tagline">Ideias, opiniões e descobertas, sem rodeios.</p>
      <p className="status">Em construção.</p>
    </div>
  )
}
