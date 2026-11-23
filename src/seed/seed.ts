import type { Payload } from 'payload'

import { lexicalFromBlocks } from '../lib/lexicalBuilder'
import { COVERS, renderCover } from './covers'
import { SAMPLE_POSTS } from './samplePosts'

/**
 * Seed SÓ de desenvolvimento. Recusa rodar em produção ou contra um banco
 * que não seja local (127.0.0.1, localhost ou o serviço `mongo` do compose).
 */
export function assertSeedAllowed(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV === 'production') {
    throw new Error('Seed bloqueado: NODE_ENV=production. O seed roda só em dev.')
  }
  const uri = env.DATABASE_URI || ''
  let host = ''
  try {
    host = new URL(uri).hostname
  } catch {
    throw new Error('Seed bloqueado: DATABASE_URI inválido.')
  }
  if (!['127.0.0.1', 'localhost', 'mongo'].includes(host)) {
    throw new Error(`Seed bloqueado: banco "${host}" não é local.`)
  }
}

async function upsertBySlug<T extends 'tags' | 'categories' | 'pages' | 'posts'>(
  payload: Payload,
  collection: T,
  slug: string,
  data: Record<string, unknown>,
) {
  const existing = await payload.find({
    collection,
    where: { slug: { equals: slug } },
    limit: 1,
    draft: true,
  })
  if (existing.docs[0]) return { doc: existing.docs[0], created: false }
  const doc = await payload.create({ collection, data: { ...data, slug } as never })
  return { doc, created: true }
}

export async function seed(payload: Payload): Promise<{ created: string[] }> {
  assertSeedAllowed()
  const created: string[] = []
  const track = (label: string, r: { created: boolean }) => {
    if (r.created) created.push(label)
  }

  const categories: Record<string, string> = {}
  for (const [name, slug, color, description] of [
    ['Opinião', 'opiniao', '#D9480F', 'O que eu penso, sem rodeios.'],
    ['Tutorial', 'tutorial', '#1971C2', 'Passo a passo do que funcionou pra mim.'],
    ['Diário', 'diario', '#2F9E44', 'Notas do dia a dia de projetos.'],
  ] as const) {
    const r = await upsertBySlug(payload, 'categories', slug, { name, color, description })
    categories[slug] = String(r.doc.id)
    track(`categoria ${name}`, r)
  }

  const tags: string[] = []
  for (const [name, slug, description] of [
    ['IA', 'ia', 'Modelos locais, ferramentas e o que dá pra fazer sem nuvem.'],
    ['Homelab', 'homelab', 'Servidor em casa, Docker, backup e as dores de manter tudo de pé.'],
    ['Carreira', 'carreira', 'Trabalho, aprendizado e o dia a dia de dev.'],
  ] as const) {
    const r = await upsertBySlug(payload, 'tags', slug, { name, description })
    tags.push(String(r.doc.id))
    track(`tag ${name}`, r)
  }

  track(
    'página Sobre',
    await upsertBySlug(payload, 'pages', 'sobre', {
      title: 'Sobre',
      _status: 'published',
      content: lexicalFromBlocks([
        'Texto provisório do seed de desenvolvimento. A foto e a bio de verdade entram depois, pelo admin.',
        { heading: 'Por que este blog' },
        'Espaço pra mostrar como fica o texto livre do Sobre: parágrafos, subtítulos e links, no mesmo estilo dos posts.',
      ]),
    }),
  )

  track(
    'post de exemplo',
    await upsertBySlug(payload, 'posts', 'ola-mundo-pronto-falei', {
      title: 'Olá, mundo: pronto, falei!',
      subtitle: 'Post de exemplo do seed de desenvolvimento.',
      _status: 'published',
      category: categories.opiniao,
      tags: tags.slice(0, 2),
      featured: false,
      publishedAt: '2026-08-30T12:00:00.000Z',
      content: lexicalFromBlocks([
        { heading: 'Por que um blog' },
        'Este é um post de exemplo criado pelo seed de desenvolvimento. Ele existe só pra ter conteúdo no admin e no site enquanto o blog é construído.',
        'Algumas ideias precisam ser compartilhadas, e este é o espaço pra isso.',
      ]),
      summary:
        'Post de exemplo do seed de desenvolvimento: mostra como fica um texto com síntese, pontos-chave, categoria e tags enquanto o blog Pronto, Falei! é construído passo a passo.',
      keyPoints: [
        { text: 'O seed roda só em desenvolvimento.' },
        { text: 'A síntese tem entre 160 e 400 caracteres.' },
        { text: 'Os pontos-chave vão de 3 a 5 itens.' },
      ],
      summarySource: 'manual',
    }),
  )

  // Capas de exemplo (idempotente pelo texto alternativo).
  const covers: Record<string, string> = {}
  for (const spec of COVERS) {
    const existing = await payload.find({
      collection: 'media',
      where: { alt: { equals: spec.alt } },
      limit: 1,
      depth: 0,
    })
    if (existing.docs[0]) {
      covers[spec.key] = String(existing.docs[0].id)
      continue
    }
    const data = await renderCover(spec)
    const media = await payload.create({
      collection: 'media',
      data: { alt: spec.alt, credit: 'Ilustração gerada pelo seed' },
      file: { data, mimetype: 'image/png', name: `capa-${spec.key}.png`, size: data.length },
    })
    covers[spec.key] = String(media.id)
    created.push(`capa ${spec.key}`)
  }

  const tagIds: Record<string, string> = { ia: tags[0], homelab: tags[1], carreira: tags[2] }
  for (const sample of SAMPLE_POSTS) {
    track(
      `post ${sample.slug}`,
      await upsertBySlug(payload, 'posts', sample.slug, {
        title: sample.title,
        subtitle: sample.subtitle,
        _status: 'published',
        publishedAt: sample.publishedAt,
        category: categories[sample.category],
        tags: sample.tags.map((t) => tagIds[t]),
        featured: Boolean(sample.featured),
        cover: sample.cover ? covers[sample.cover] : undefined,
        content: lexicalFromBlocks(
          sample.paragraphs.map((b) =>
            typeof b === 'object' && 'image' in b && b.image.startsWith('cover:')
              ? { ...b, image: covers[b.image.slice(6)] }
              : b,
          ),
        ),
        summary: sample.summary,
        keyPoints: sample.keyPoints.map((text) => ({ text })),
        summarySource: 'manual',
      }),
    )
  }

  // Redirecionamento de exemplo (URL antiga do post de boas-vindas).
  const existingRedirect = await payload.find({
    collection: 'redirects',
    where: { from: { equals: '/2026/ola-mundo' } },
    limit: 1,
    depth: 0,
  })
  if (!existingRedirect.docs[0]) {
    const hello = await payload.find({
      collection: 'posts',
      where: { slug: { equals: 'ola-mundo-pronto-falei' } },
      limit: 1,
      depth: 0,
    })
    if (hello.docs[0]) {
      await payload.create({
        collection: 'redirects',
        data: {
          from: '/2026/ola-mundo',
          type: '301',
          to: { type: 'reference', reference: { relationTo: 'posts', value: hello.docs[0].id } },
        },
      })
      created.push('redirecionamento /2026/ola-mundo')
    }
  }

  return { created }
}
