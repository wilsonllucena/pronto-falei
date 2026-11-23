import React from 'react'

import './styles.css'

export const metadata = {
  title: 'Pronto, Falei!',
  description: 'Ideias, opiniões e descobertas, sem rodeios. Blog do Wilson Lima.',
}

export default function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  return (
    <html lang="pt-BR">
      <body>
        <main>{children}</main>
      </body>
    </html>
  )
}
