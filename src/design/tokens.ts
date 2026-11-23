/**
 * Tokens de design do Pronto, Falei! — a paleta muda num lugar só.
 * O layout injeta `themeCss()` no <head>, e o CSS usa só as variáveis.
 */
export type ThemeName = 'light' | 'dark'

export type Palette = {
  /** Fundo, papel quente */
  paper: string
  /** Superfície levemente destacada (cards, header) */
  surface: string
  /** Texto */
  ink: string
  /** Datas, metadados */
  muted: string
  /** "Falei!", títulos h2, detalhes grandes */
  accent: string
  /** Laranja pra texto pequeno e links (contraste AA garantido) */
  accentText: string
  /** Grifo de marca-texto, seleção, TL;DR */
  highlight: string
  /** Linhas e cards */
  border: string
}

export const PALETTES: Record<ThemeName, Palette> = {
  light: {
    paper: '#FAF7F0',
    surface: '#FFFDF8',
    ink: '#1B1B1B',
    muted: '#6B665E',
    accent: '#D9480F',
    accentText: '#B93D0C',
    highlight: '#FFD23F',
    border: '#E6E1D6',
  },
  dark: {
    paper: '#141414',
    surface: '#1B1B1B',
    ink: '#EDEAE3',
    muted: '#A8A39A',
    accent: '#FF7A4D',
    accentText: '#FF7A4D',
    highlight: 'rgba(255, 200, 61, 0.28)',
    border: '#2A2A2A',
  },
}

export const FONT_VARS = {
  display: '--font-display',
  serif: '--font-serif',
  sans: '--font-sans',
  mono: '--font-mono',
} as const

const toKebab = (s: string) => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)

export function paletteVars(p: Palette): string {
  return Object.entries(p)
    .map(([k, v]) => `--c-${toKebab(k)}:${v};`)
    .join('')
}

/**
 * CSS dos temas: o claro é o padrão, o escuro vale quando o sistema pede
 * (sem escolha manual) ou quando `data-theme="dark"` está no <html>.
 */
export function themeCss(): string {
  const light = paletteVars(PALETTES.light)
  const dark = paletteVars(PALETTES.dark)
  return [
    `:root{${light}color-scheme:light;}`,
    `@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${dark}color-scheme:dark;}}`,
    `:root[data-theme="dark"]{${dark}color-scheme:dark;}`,
  ].join('\n')
}

/* ---------- contraste WCAG ---------- */

function parseColor(c: string): [number, number, number, number] {
  const hex = c.match(/^#([0-9a-f]{6})$/i)
  if (hex) {
    const n = parseInt(hex[1], 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1]
  }
  const rgba = c.match(/^rgba?\(([^)]+)\)$/i)
  if (rgba) {
    const [r, g, b, a = '1'] = rgba[1].split(',').map((s) => s.trim())
    return [Number(r), Number(g), Number(b), Number(a)]
  }
  throw new Error(`cor inválida: ${c}`)
}

/** Compõe uma cor (com alfa) sobre um fundo opaco. */
export function flatten(color: string, background: string): [number, number, number] {
  const [r, g, b, a] = parseColor(color)
  const [br, bg, bb] = parseColor(background)
  return [r * a + br * (1 - a), g * a + bg * (1 - a), b * a + bb * (1 - a)]
}

function luminance([r, g, b]: [number, number, number]): number {
  const ch = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)
}

/** Razão de contraste WCAG 2.x entre o texto e o fundo (fundo pode ter alfa sobre `base`). */
export function contrastRatio(fg: string, bg: string, base = bg): number {
  const back = flatten(bg, base.startsWith('#') ? base : '#000000')
  const backHex = `rgb(${back.map(Math.round).join(',')})`
  const front = flatten(fg, backHex)
  const l1 = luminance(front)
  const l2 = luminance(back)
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1]
  return (hi + 0.05) / (lo + 0.05)
}
