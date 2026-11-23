import { describe, expect, it } from 'vitest'

import { contrastRatio, flatten, PALETTES, paletteVars, themeCss } from '@/design/tokens'
import {
  dateParts,
  formatDate,
  formatShortDate,
  groupByMonth,
  monthLabel,
  plural,
} from '@/lib/dates'
import { parseTheme, THEME_COOKIE, themeCookie, themeInitScript } from '@/lib/theme'

describe('tokens de cor', () => {
  it('têm os valores do plano', () => {
    expect(PALETTES.light).toMatchObject({
      paper: '#FAF7F0',
      ink: '#1B1B1B',
      muted: '#6B665E',
      accent: '#D9480F',
      accentText: '#B93D0C',
      highlight: '#FFD23F',
      border: '#E6E1D6',
    })
    expect(PALETTES.dark).toMatchObject({
      paper: '#141414',
      ink: '#EDEAE3',
      muted: '#A8A39A',
      accent: '#FF7A4D',
      border: '#2A2A2A',
    })
  })

  for (const theme of ['light', 'dark'] as const) {
    const p = PALETTES[theme]
    it(`passam de 4.5:1 no texto (${theme})`, () => {
      for (const bg of [p.paper, p.surface]) {
        expect(contrastRatio(p.ink, bg)).toBeGreaterThanOrEqual(4.5)
        expect(contrastRatio(p.muted, bg)).toBeGreaterThanOrEqual(4.5)
        expect(contrastRatio(p.accentText, bg)).toBeGreaterThanOrEqual(4.5)
      }
      // texto sobre o grifo (marca-texto com alfa no escuro)
      expect(contrastRatio(p.ink, p.highlight, p.paper)).toBeGreaterThanOrEqual(4.5)
      // botão escuro: papel sobre tinta e papel sobre laranja (hover)
      expect(contrastRatio(p.paper, p.ink)).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(p.paper, p.accentText)).toBeGreaterThanOrEqual(4.5)
      // "Falei!" é texto grande: 3:1 basta
      expect(contrastRatio(p.accent, p.paper)).toBeGreaterThanOrEqual(3)
    })
  }

  it('calcula contraste e alfa como o WCAG', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0)
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5)
    expect(flatten('rgba(255, 255, 255, 0.5)', '#000000')).toEqual([127.5, 127.5, 127.5])
    expect(() => contrastRatio('laranja', '#fff')).toThrow(/cor inválida/)
  })

  it('geram as variáveis CSS dos dois temas', () => {
    expect(paletteVars(PALETTES.light)).toContain('--c-accent-text:#B93D0C;')
    const css = themeCss()
    expect(css).toContain(':root{--c-paper:#FAF7F0;')
    expect(css).toContain(
      '@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--c-paper:#141414;',
    )
    expect(css).toContain(':root[data-theme="dark"]{--c-paper:#141414;')
  })
})

describe('tema claro/escuro', () => {
  it('aceita só light e dark', () => {
    expect(parseTheme('dark')).toBe('dark')
    expect(parseTheme('light')).toBe('light')
    expect(parseTheme('sepia')).toBeNull()
    expect(parseTheme(undefined)).toBeNull()
  })

  it('salva a escolha num cookie de um ano', () => {
    expect(themeCookie('dark')).toBe(`${THEME_COOKIE}=dark; Path=/; Max-Age=31536000; SameSite=Lax`)
  })

  it('o script do <head> aplica o cookie antes da pintura', () => {
    const run = (cookie: string) => {
      const attrs: Record<string, string> = {}
      const document = {
        cookie,
        documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) },
      }
      new Function('document', themeInitScript)(document)
      return attrs['data-theme']
    }
    expect(run(`a=1; ${THEME_COOKIE}=dark; b=2`)).toBe('dark')
    expect(run(`${THEME_COOKIE}=light`)).toBe('light')
    expect(run(`${THEME_COOKIE}=roxo`)).toBeUndefined()
    expect(run('')).toBeUndefined()
  })
})

describe('datas em pt-BR no fuso de São Paulo', () => {
  it('formata curto, longo e mês', () => {
    expect(formatShortDate('2026-11-20T12:00:00.000Z')).toBe('20 nov')
    expect(formatDate('2026-03-05T12:00:00.000Z')).toBe('05 mar 2026')
    expect(monthLabel(2026, 3)).toBe('março de 2026')
  })

  it('usa o fuso do site, não o UTC', () => {
    // 01/12 01:00 UTC ainda é 30/11 em São Paulo
    expect(dateParts('2026-12-01T01:00:00.000Z')).toEqual({ year: 2026, month: 11, day: 30 })
  })

  it('agrupa por mês mantendo a ordem', () => {
    const items = [
      { t: 'a', d: '2026-11-20T12:00:00Z' },
      { t: 'b', d: '2026-11-02T12:00:00Z' },
      { t: 'c', d: '2026-12-01T01:00:00Z' },
      { t: 'd', d: '2026-10-28T12:00:00Z' },
    ]
    const groups = groupByMonth(items, (i) => i.d)
    expect(groups.map((g) => [g.label, g.items.map((i) => i.t).join('')])).toEqual([
      ['novembro de 2026', 'abc'],
      ['outubro de 2026', 'd'],
    ])
  })

  it('pluraliza', () => {
    expect(plural(1, 'texto', 'textos')).toBe('1 texto')
    expect(plural(4, 'texto', 'textos')).toBe('4 textos')
  })
})
