import { describe, expect, it } from 'vitest'

import { groupByYear } from '@/lib/dates'
import { normalizePath, redirectTarget } from '@/lib/redirects'
import {
  accentInsensitivePattern,
  fold,
  foldText,
  highlight,
  normalizeQuery,
  SEARCH_MAX_QUERY,
  searchTerms,
  snippet,
} from '@/lib/search'
import { categoryHref } from '@/lib/site'
import { SEARCH_TEXT_INDEX } from '@/plugins/search'

const joined = (segs: { text: string; hit: boolean }[]) =>
  segs.map((s) => (s.hit ? `[${s.text}]` : s.text)).join('')

describe('busca: consulta e termos', () => {
  it('normaliza a consulta da URL', () => {
    expect(normalizeQuery('  ia   local ')).toBe('ia local')
    expect(normalizeQuery(['docker', 'x'])).toBe('docker')
    expect(normalizeQuery(undefined)).toBe('')
    expect(normalizeQuery(42)).toBe('')
    expect(normalizeQuery('a'.repeat(300))).toHaveLength(SEARCH_MAX_QUERY)
  })

  it('tira acento sem mudar o tamanho', () => {
    expect(fold('Ã')).toBe('a')
    expect(fold('ç')).toBe('c')
    expect(foldText('Ação Rápida')).toBe('acao rapida')
    expect(foldText('Ação Rápida')).toHaveLength('Ação Rápida'.length)
  })

  it('termos: sem stopwords, sem repetição, plural vira radical, maior primeiro', () => {
    expect(searchTerms('IA local no homelab')).toEqual(['homelab', 'local', 'ia'])
    expect(searchTerms('modelos Modelos')).toEqual(['modelo'])
    expect(searchTerms('de a o')).toEqual([])
    expect(searchTerms('Ação')).toEqual(['acao'])
  })
})

describe('busca: destaque e trecho', () => {
  it('marca os termos ignorando acento e caixa', () => {
    expect(joined(highlight('Configuração do Homelab', ['configuracao', 'homelab']))).toBe(
      '[Configuração] do [Homelab]',
    )
  })

  it('junta ocorrências sobrepostas', () => {
    expect(joined(highlight('dockerfile', ['docker', 'kerf']))).toBe('[dockerf]ile')
  })

  it('trecho em volta do termo, cortando em palavra e com reticências', () => {
    const text = `${'palavra '.repeat(40)}o modelo quantizado roda na CPU ${'fim '.repeat(40)}`
    const segs = snippet(text, ['quantizado'], 40)
    const out = joined(segs)
    expect(out.startsWith('… ')).toBe(true)
    expect(out.endsWith(' …')).toBe(true)
    expect(out).toContain('[quantizado]')
    expect(out).toMatch(/^… palavra /)
  })

  it('sem termo no texto: começo do texto', () => {
    const out = joined(snippet('Texto curto sem nada.', ['xyz']))
    expect(out).toBe('Texto curto sem nada.')
    expect(snippet('', ['a'])).toEqual([])
  })

  it('regex tolerante a acento pra busca parcial', () => {
    const re = new RegExp(accentInsensitivePattern('acao'), 'i')
    expect(re.test('Ação')).toBe(true)
    expect(re.test('acao')).toBe(true)
    expect(new RegExp(accentInsensitivePattern('c++'), 'i').test('c++')).toBe(true)
  })

  it('índice de texto em português com peso maior no título', () => {
    expect(SEARCH_TEXT_INDEX.options.default_language).toBe('portuguese')
    const w = SEARCH_TEXT_INDEX.options.weights
    expect(w.title).toBeGreaterThan(w.summary)
    expect(w.summary).toBeGreaterThan(w.body)
  })
})

describe('redirecionamentos', () => {
  it('normaliza o caminho de origem', () => {
    expect(normalizePath('/Antigo/Post/')).toBe('/antigo/post')
    expect(normalizePath('antigo')).toBe('/antigo')
    expect(normalizePath('https://prontofalei.dev/2024/x?utm=1#a')).toBe('/2024/x')
    expect(normalizePath('//dois//')).toBe('/dois')
    expect(normalizePath('/')).toBe('/')
    expect(normalizePath('   ')).toBe('')
    expect(normalizePath('/caf%C3%A9')).toBe('/café')
  })

  it('destino: post, página, URL própria e tipo 301/302', () => {
    expect(
      redirectTarget({
        from: '/velho',
        type: '301',
        to: { type: 'reference', reference: { relationTo: 'posts', value: { slug: 'novo' } } },
      }),
    ).toEqual({ to: '/posts/novo', permanent: true })
    expect(
      redirectTarget({
        from: '/eu',
        type: '302',
        to: { type: 'reference', reference: { relationTo: 'pages', value: { slug: 'sobre' } } },
      }),
    ).toEqual({ to: '/sobre', permanent: false })
    expect(
      redirectTarget({ from: '/gh', to: { type: 'custom', url: 'https://github.com/x' } }),
    ).toEqual({ to: 'https://github.com/x', permanent: true })
  })

  it('ignora destino incompleto, rascunho, esquema estranho e laço', () => {
    expect(redirectTarget({ from: '/a', to: { type: 'custom', url: '' } })).toBeNull()
    expect(
      redirectTarget({ from: '/a', to: { type: 'custom', url: 'javascript:alert(1)' } }),
    ).toBeNull()
    expect(
      redirectTarget({
        from: '/a',
        to: { type: 'reference', reference: { relationTo: 'posts', value: 'id-sem-populate' } },
      }),
    ).toBeNull()
    expect(
      redirectTarget({
        from: '/a',
        to: {
          type: 'reference',
          reference: { relationTo: 'posts', value: { slug: 'x', _status: 'draft' } },
        },
      }),
    ).toBeNull()
    expect(redirectTarget({ from: '/Sobre/', to: { type: 'custom', url: '/sobre' } })).toBeNull()
  })
})

describe('arquivo e links', () => {
  it('agrupa por ano › mês no fuso do site', () => {
    const items = [
      { d: '2026-11-20T12:00:00Z' },
      { d: '2026-11-02T12:00:00Z' },
      { d: '2026-10-09T12:00:00Z' },
      { d: '2026-01-01T02:00:00Z' }, // 31/12/2025 23h em Brasília
    ]
    const years = groupByYear(items, (i) => i.d)
    expect(years.map((y) => [y.year, y.count])).toEqual([
      [2026, 3],
      [2025, 1],
    ])
    expect(years[0].months.map((m) => m.label)).toEqual(['novembro de 2026', 'outubro de 2026'])
    expect(years[1].months[0].label).toBe('dezembro de 2025')
  })

  it('link de categoria', () => {
    expect(categoryHref('tutorial')).toBe('/categorias/tutorial')
  })
})
