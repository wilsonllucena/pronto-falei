import type { Payload } from 'payload'

import { lexicalFromBlocks } from '../lib/lexicalBuilder'

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
  for (const [name, slug] of [
    ['IA', 'ia'],
    ['Homelab', 'homelab'],
    ['Carreira', 'carreira'],
  ] as const) {
    const r = await upsertBySlug(payload, 'tags', slug, { name })
    tags.push(String(r.doc.id))
    track(`tag ${name}`, r)
  }

  track(
    'página Sobre',
    await upsertBySlug(payload, 'pages', 'sobre', {
      title: 'Sobre',
      _status: 'draft',
      content: lexicalFromBlocks([
        'Texto provisório do seed de desenvolvimento. A foto e a bio de verdade entram depois.',
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
      featured: true,
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

  return { created }
}
