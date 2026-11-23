import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { lexicalFromBlocks } from '@/lib/lexicalBuilder'
import config from '@/payload.config'

let payload: Payload
const run = Date.now().toString(36)
const created: { collection: 'posts' | 'pages' | 'tags' | 'categories'; id: string }[] = []

const summary =
  'Síntese de teste com tamanho suficiente pra passar na validação do plano, que exige no mínimo cento e sessenta caracteres e no máximo quatrocentos caracteres no TL;DR.'
type Doc = { id: string | number; slug?: string | null; [key: string]: unknown }
/** Atalho do Local API sem a tipagem estrita de campos gerados (slug/generateSlug). */
const create = (args: Record<string, unknown>) =>
  payload.create(args as never) as unknown as Promise<Doc>

const keyPoints = [
  { text: 'Primeiro ponto.' },
  { text: 'Segundo ponto.' },
  { text: 'Terceiro ponto.' },
]

describe('collections e admin (passo 2)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  afterAll(async () => {
    for (const { collection, id } of created.reverse()) {
      await payload.delete({ collection, id }).catch(() => undefined)
    }
    await payload.destroy()
  })

  it('tag e categoria geram slug sem acento', async () => {
    const tag = await create({
      collection: 'tags',
      data: { name: `Inteligência Artificial ${run}` },
    })
    created.push({ collection: 'tags', id: String(tag.id) })
    expect(tag.slug).toBe(`inteligencia-artificial-${run}`)

    const cat = await create({ collection: 'categories', data: { name: `Opinião ${run}` } })
    created.push({ collection: 'categories', id: String(cat.id) })
    expect(cat.slug).toBe(`opiniao-${run}`)
    expect(cat.color).toBe('#D9480F')
  })

  it('slug duplicado é recusado', async () => {
    await expect(
      create({
        collection: 'tags',
        data: { name: `Outra ${run}`, slug: `inteligencia-artificial-${run}` },
      }),
    ).rejects.toThrow()
  })

  it('cor de categoria inválida é recusada', async () => {
    await expect(
      create({ collection: 'categories', data: { name: `Cor ${run}`, color: 'laranja' } }),
    ).rejects.toThrow(/Cor|inválido|invalid/i)
  })

  it('rascunho de post salva sem síntese', async () => {
    const post = await create({
      collection: 'posts',
      draft: true,
      data: { title: `Rascunho ${run}`, _status: 'draft' },
    })
    created.push({ collection: 'posts', id: String(post.id) })
    expect(post._status).toBe('draft')
    expect(post.slug).toBe(`rascunho-${run}`)
  })

  it('não publica sem síntese e pontos-chave', async () => {
    await expect(
      create({
        collection: 'posts',
        data: {
          title: `Sem síntese ${run}`,
          _status: 'published',
          content: lexicalFromBlocks(['Texto.']),
        },
      }),
    ).rejects.toThrow()
  })

  it('não publica síntese curta nem com menos de 3 pontos-chave', async () => {
    await expect(
      create({
        collection: 'posts',
        data: {
          title: `Curta ${run}`,
          _status: 'published',
          content: lexicalFromBlocks(['Texto.']),
          summary: 'Curta demais.',
          keyPoints,
        },
      }),
    ).rejects.toThrow()
    await expect(
      create({
        collection: 'posts',
        data: {
          title: `Poucos pontos ${run}`,
          _status: 'published',
          content: lexicalFromBlocks(['Texto.']),
          summary,
          keyPoints: keyPoints.slice(0, 2),
        },
      }),
    ).rejects.toThrow()
  })

  it('síntese da IA não publica sem revisão', async () => {
    await expect(
      create({
        collection: 'posts',
        data: {
          title: `IA sem revisão ${run}`,
          _status: 'published',
          content: lexicalFromBlocks(['Texto.']),
          summary,
          keyPoints,
          summarySource: 'ia',
          summaryReviewed: false,
        },
      }),
    ).rejects.toThrow(/revis/i)
  })

  it('publica post completo e calcula leitura, palavras e data', async () => {
    const words = Array.from({ length: 450 }, (_, i) => `palavra${i}`).join(' ')
    const post = await create({
      collection: 'posts',
      data: {
        title: `Publicado ${run}`,
        subtitle: 'Linha fina',
        _status: 'published',
        content: lexicalFromBlocks([{ heading: 'Intro' }, words]),
        summary,
        keyPoints,
        summarySource: 'ia',
        summaryReviewed: true,
      },
    })
    created.push({ collection: 'posts', id: String(post.id) })
    expect(post._status).toBe('published')
    expect(post.wordCount).toBe(451)
    expect(post.readingTime).toBe(3)
    expect(post.publishedAt).toBeTruthy()
  })

  it('visitante só vê post publicado; logado vê rascunho', async () => {
    const anon = await payload.find({
      collection: 'posts',
      overrideAccess: false,
      where: { title: { like: run } },
    })
    expect(anon.docs.map((d) => d.title)).toEqual([`Publicado ${run}`])

    const all = await payload.find({
      collection: 'posts',
      draft: true,
      where: { title: { like: run } },
    })
    expect(all.totalDocs).toBe(2)
  })

  it('página de rascunho é invisível pro visitante', async () => {
    const page = await create({
      collection: 'pages',
      draft: true,
      data: { title: `Sobre ${run}`, _status: 'draft' },
    })
    created.push({ collection: 'pages', id: String(page.id) })
    expect(page.slug).toBe(`sobre-${run}`)
    const anon = await payload.find({
      collection: 'pages',
      overrideAccess: false,
      where: { slug: { equals: page.slug } },
    })
    expect(anon.totalDocs).toBe(0)
  })

  it('visitante não cria usuário', async () => {
    await expect(
      create({
        collection: 'users',
        overrideAccess: false,
        data: { email: `x-${run}@pronto-falei.local`, password: 'irrelevante-123' },
      }),
    ).rejects.toThrow()
  })

  it('globals têm os valores padrão', async () => {
    const settings = await payload.findGlobal({ slug: 'site-settings' })
    expect(settings.siteName).toBe('Pronto, Falei!')
    expect(settings.aiRobots).toBe('allow')
    const nav = await payload.findGlobal({ slug: 'navigation' })
    expect(nav).toBeDefined()
  })
})
