import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { lexicalFromBlocks as srcLexical } from '@/lib/lexicalBuilder'
import {
  SUMMARY_MAX,
  SUMMARY_MIN,
  KEY_POINT_MAX,
  KEY_POINTS_MAX,
  KEY_POINTS_MIN,
} from '@/lib/summary'
import { CODE_LANGUAGES as SRC_LANGUAGES } from '@/blocks'
import {
  CODE_LANGUAGES,
  RULES,
  lexicalFromBlocks,
  loadContent,
  markdownToBlocks,
  parseArgs,
  parseFrontmatter,
  parseInline,
  validateArticle,
  wordCount,
  type Block,
} from '../../scripts/import-content'

const CONTENT = path.resolve(__dirname, '../../content')

/** Tira os ids gerados (mudam a cada chamada) pra comparar a estrutura. */
const noIds = (v: unknown): unknown =>
  JSON.parse(JSON.stringify(v, (k, val) => (k === 'id' ? undefined : val)))

describe('import-content: frontmatter e markdown', () => {
  it('lê escalares, aspas, booleanos, números e listas', () => {
    const { data, body } = parseFrontmatter(
      '---\ntitulo: "Olá: mundo"\nordem: 3\ndestaque: true\ntags:\n  - ia\n  - homelab\n---\nCorpo\n',
    )
    expect(data).toEqual({
      titulo: 'Olá: mundo',
      ordem: 3,
      destaque: true,
      tags: ['ia', 'homelab'],
    })
    expect(body).toBe('Corpo\n')
    expect(() => parseFrontmatter('sem frontmatter')).toThrow(/frontmatter/)
  })

  it('inline: código, negrito, itálico e link', () => {
    expect(parseInline('Use `ls`, **sempre**, *às vezes* e [docs](https://x.dev).')).toEqual([
      'Use ',
      { text: 'ls', code: true },
      ', ',
      { text: 'sempre', bold: true },
      ', ',
      { text: 'às vezes', italic: true },
      ' e ',
      { text: 'docs', href: 'https://x.dev' },
      '.',
    ])
  })

  it('blocos: títulos, listas, código, destaque e citação', () => {
    const md = [
      '## Título',
      '### Sub',
      'Linha um',
      'continua aqui.',
      '',
      '- item **a**',
      '- item b',
      '  continuação',
      '',
      '1. primeiro',
      '2. segundo',
      '',
      '```sh title="x.sh"',
      'echo oi',
      '',
      'echo tchau',
      '```',
      '',
      '> [!dica] Uma dica',
      '> Use o `.env`.',
      '',
      '> Frase boa.',
      '> — Alguém',
    ].join('\n')
    expect(markdownToBlocks(md)).toEqual([
      { heading: 'Título', tag: 'h2' },
      { heading: 'Sub', tag: 'h3' },
      'Linha um continua aqui.',
      { list: [['item ', { text: 'a', bold: true }], ['item b continuação']] },
      { list: [['primeiro'], ['segundo']], ordered: true },
      { code: 'echo oi\n\necho tchau', language: 'bash', title: 'x.sh' },
      { callout: 'Use o .env.', tone: 'dica', title: 'Uma dica' },
      { quote: 'Frase boa.', author: 'Alguém' },
    ])
  })

  it('recusa linguagem desconhecida, # solto e bloco sem fechamento', () => {
    expect(() => markdownToBlocks('```cobol\nx\n```')).toThrow(/linguagem/)
    expect(() => markdownToBlocks('# Título')).toThrow(/##/)
    expect(() => markdownToBlocks('```bash\nx')).toThrow(/fechamento/)
    expect(() => markdownToBlocks('> [!uau] x\n> y')).toThrow(/destaque/)
  })

  it('o Lexical gerado é igual ao do lexicalBuilder do app', () => {
    const blocks: Block[] = [
      { heading: 'A', tag: 'h3' },
      'texto',
      { paragraph: ['a ', { text: 'b', bold: true }, { text: 'c', href: 'https://x.dev' }] },
      { list: [['um'], [{ text: 'dois', code: true }]], ordered: true },
      { code: 'x', language: 'bash', title: 't' },
      { callout: 'c', tone: 'atencao', title: 'T' },
      { quote: 'q', author: 'a' },
    ]
    expect(noIds(lexicalFromBlocks(blocks))).toEqual(noIds(srcLexical(blocks)))
  })

  it('as regras espelham as do app', () => {
    expect(RULES).toMatchObject({
      summaryMin: SUMMARY_MIN,
      summaryMax: SUMMARY_MAX,
      keyPointsMin: KEY_POINTS_MIN,
      keyPointsMax: KEY_POINTS_MAX,
      keyPointMax: KEY_POINT_MAX,
    })
    expect(CODE_LANGUAGES).toEqual([...SRC_LANGUAGES])
  })

  it('argumentos: rascunho por padrão, publica só com --publicar', () => {
    expect(parseArgs([])).toMatchObject({ publish: false, update: false, dryRun: false })
    expect(parseArgs(['--publicar', '--url', 'http://x:1'])).toMatchObject({
      publish: true,
      url: 'http://x:1',
    })
  })
})

describe('artigos de lançamento (content/)', () => {
  const { articles, taxonomy } = loadContent(CONTENT)

  it('são 7, com slugs únicos e todos válidos pra publicar', () => {
    expect(articles).toHaveLength(7)
    for (const a of articles) expect(validateArticle(a, taxonomy), a.file).toEqual([])
  })

  it('têm de 800 a 1500 palavras', () => {
    for (const a of articles) {
      const n = wordCount(a.body)
      expect(n, a.file).toBeGreaterThanOrEqual(800)
      expect(n, a.file).toBeLessThanOrEqual(1500)
    }
  })

  it('a série Homelab do zero tem 3 partes em ordem', () => {
    const parts = articles.filter((a) => a.serie === 'homelab-do-zero').map((a) => a.serieOrdem)
    expect(parts.sort()).toEqual([1, 2, 3])
  })

  it('não vazam IPs internos, hostnames do tailnet nem segredos', () => {
    const all = articles.map((a) => a.body + a.resumo).join('\n')
    expect(all).not.toMatch(
      /\b(?:192\.168|10\.\d+\.\d+|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7]))\.\d+/,
    )
    expect(all).not.toMatch(/\.ts\.net|tail[0-9a-f]{4,}/i)
    expect(all).not.toMatch(/(?:password|senha|secret|token)\s*[:=]\s*["']?[A-Za-z0-9+/]{12,}/i)
    expect(all).not.toMatch(/lorem ipsum/i)
  })
})
