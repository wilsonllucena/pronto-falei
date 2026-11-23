import { describe, expect, it } from 'vitest'

import { validateEmbedUrl } from '@/blocks'
import { validateHexColor } from '@/collections/Categories'
import { countWords, lexicalToPlainText, readingStats, readingTimeMinutes } from '@/lib/lexical'
import { lexicalFromBlocks } from '@/lib/lexicalBuilder'
import { seoDescription, seoTitle } from '@/lib/seo'
import { toSlug } from '@/lib/slugify'
import { validateSummaryReviewed } from '@/lib/summary'
import { assertSeedAllowed } from '@/seed/seed'

describe('toSlug', () => {
  it('remove acentos e pontuação', () => {
    expect(toSlug('Opinião sem rodeios!')).toBe('opiniao-sem-rodeios')
    expect(toSlug('  Ação & Reação  ')).toBe('acao-e-reacao')
    expect(toSlug('Next.js 16 + Payload 3')).toBe('next-js-16-payload-3')
  })
  it('retorna undefined pra vazio ou não-string', () => {
    expect(toSlug('!!!')).toBeUndefined()
    expect(toSlug(undefined)).toBeUndefined()
  })
})

describe('tempo de leitura', () => {
  it('conta palavras com acento e hífen', () => {
    expect(countWords('Pronto, falei! Ideias e opiniões — sem rodeios.')).toBe(7)
    expect(countWords('bem-vindo ao blog')).toBe(3)
  })
  it('220 palavras por minuto, arredondando pra cima', () => {
    expect(readingTimeMinutes(0)).toBe(0)
    expect(readingTimeMinutes(1)).toBe(1)
    expect(readingTimeMinutes(220)).toBe(1)
    expect(readingTimeMinutes(221)).toBe(2)
  })
  it('extrai texto do Lexical, incluindo blocos', () => {
    const state = lexicalFromBlocks([{ heading: 'Título' }, 'Um dois três.'])
    state.root.children.push({
      type: 'block',
      fields: { blockType: 'code', code: 'const x = 1' },
    } as never)
    expect(lexicalToPlainText(state)).toBe('Título Um dois três. const x = 1')
    expect(readingStats(state)).toEqual({ wordCount: 7, readingTime: 1 })
    expect(readingStats(null)).toEqual({ wordCount: 0, readingTime: 0 })
  })
  it('post longo', () => {
    const text = Array.from({ length: 1000 }, (_, i) => `palavra${i}`).join(' ')
    expect(readingStats(lexicalFromBlocks([text]))).toEqual({ wordCount: 1000, readingTime: 5 })
  })
})

describe('síntese', () => {
  it('origem manual publica sem revisão', () => {
    expect(validateSummaryReviewed(false, 'manual')).toBe(true)
  })
  it('origem IA exige revisão', () => {
    expect(validateSummaryReviewed(false, 'ia')).toMatch(/revise/)
    expect(validateSummaryReviewed(false, 'ia-editada')).toMatch(/revise/)
    expect(validateSummaryReviewed(true, 'ia')).toBe(true)
  })
})

describe('SEO', () => {
  it('título com o nome do blog', () => {
    expect(seoTitle({ title: 'Meu post' })).toBe('Meu post · Pronto, Falei!')
    expect(seoTitle({})).toBe('Pronto, Falei!')
  })
  it('descrição vem do summary, senão da linha fina, cortada em 160', () => {
    expect(seoDescription({ summary: 'Curto.', subtitle: 'x' })).toBe('Curto.')
    expect(seoDescription({ subtitle: 'Linha fina' })).toBe('Linha fina')
    const long = 'palavra '.repeat(60)
    const d = seoDescription({ summary: long })
    expect(d.length).toBeLessThanOrEqual(160)
    expect(d.endsWith('…')).toBe(true)
  })
})

describe('validações de campos', () => {
  it('cor hex', () => {
    expect(validateHexColor('#D9480F')).toBe(true)
    expect(validateHexColor('')).toBe(true)
    expect(validateHexColor('laranja')).toMatch(/hex/)
  })
  it('embed só YouTube/X em https', () => {
    expect(validateEmbedUrl('https://www.youtube.com/watch?v=abc')).toBe(true)
    expect(validateEmbedUrl('https://x.com/user/status/1')).toBe(true)
    expect(validateEmbedUrl('http://youtube.com/x')).toMatch(/https/)
    expect(validateEmbedUrl('https://evil.example.com')).toMatch(/YouTube/)
    expect(validateEmbedUrl('nada')).toMatch(/inválida/)
  })
})

describe('seed só em dev', () => {
  it('bloqueia em produção', () => {
    expect(() =>
      assertSeedAllowed({ NODE_ENV: 'production', DATABASE_URI: 'mongodb://127.0.0.1/x' } as never),
    ).toThrow(/production/)
  })
  it('bloqueia banco remoto', () => {
    expect(() =>
      assertSeedAllowed({
        NODE_ENV: 'development',
        DATABASE_URI: 'mongodb://db.exemplo.com/x',
      } as never),
    ).toThrow(/não é local/)
  })
  it('libera banco local', () => {
    expect(() =>
      assertSeedAllowed({ NODE_ENV: 'test', DATABASE_URI: 'mongodb://127.0.0.1:27017/x' } as never),
    ).not.toThrow()
    expect(() =>
      assertSeedAllowed({
        NODE_ENV: 'development',
        DATABASE_URI: 'mongodb://mongo:27017/x',
      } as never),
    ).not.toThrow()
  })
})
