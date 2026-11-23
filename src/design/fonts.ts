/**
 * Fontes servidas pelo próprio site (next/font/local + arquivos do Fontsource),
 * sem nenhuma chamada ao Google em build ou em runtime. Só o subset latin,
 * que cobre o português.
 */
import localFont from 'next/font/local'

export const display = localFont({
  src: '../../node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-opsz-normal.woff2',
  variable: '--font-display',
  weight: '200 800',
  display: 'swap',
  fallback: ['system-ui', 'sans-serif'],
})

export const serif = localFont({
  src: [
    {
      path: '../../node_modules/@fontsource-variable/newsreader/files/newsreader-latin-opsz-normal.woff2',
      style: 'normal',
    },
    {
      path: '../../node_modules/@fontsource-variable/newsreader/files/newsreader-latin-opsz-italic.woff2',
      style: 'italic',
    },
  ],
  variable: '--font-serif',
  weight: '200 800',
  display: 'swap',
  fallback: ['Georgia', 'serif'],
})

export const sans = localFont({
  src: '../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2',
  variable: '--font-sans',
  weight: '100 900',
  display: 'swap',
  fallback: ['system-ui', 'sans-serif'],
})

export const mono = localFont({
  src: '../../node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2',
  variable: '--font-mono',
  weight: '100 800',
  display: 'swap',
  preload: false,
  fallback: ['ui-monospace', 'monospace'],
})

export const fontVariables = [display, serif, sans, mono].map((f) => f.variable).join(' ')
