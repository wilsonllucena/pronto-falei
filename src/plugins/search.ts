/**
 * Busca (plugin-search + índice de texto do Mongo). O plugin mantém a
 * collection `search` sincronizada com os posts publicados; aqui definimos o
 * que vai pro índice (título, síntese, corpo em texto puro e tags) e criamos o
 * índice de texto em português na subida.
 */
import type { BeforeSync } from '@payloadcms/plugin-search/types'
import type { Field, Payload } from 'payload'

import { lexicalToPlainText } from '../lib/lexical'

export const SEARCH_SLUG = 'search'
/** Corpo guardado no índice: o suficiente pra achar e montar o trecho. */
export const SEARCH_BODY_MAX = 20000

const idOf = (v: unknown): string | null =>
  typeof v === 'string' ? v : v && typeof v === 'object' && 'id' in v ? String(v.id) : null

export const beforeSync: BeforeSync = async ({ originalDoc, searchDoc, req }) => {
  const tagIds = ((originalDoc.tags ?? []) as unknown[]).map(idOf).filter(Boolean) as string[]
  let tagNames = ''
  if (tagIds.length) {
    const tags = await req.payload.find({
      collection: 'tags',
      where: { id: { in: tagIds } },
      depth: 0,
      limit: tagIds.length,
      pagination: false,
      req,
    })
    tagNames = tags.docs.map((t) => `${t.name} ${t.slug}`).join(' ')
  }
  return {
    ...searchDoc,
    slug: originalDoc.slug,
    subtitle: originalDoc.subtitle ?? '',
    summary: originalDoc.summary ?? '',
    tagNames,
    body: lexicalToPlainText(originalDoc.content).slice(0, SEARCH_BODY_MAX),
    publishedAt: originalDoc.publishedAt ?? originalDoc.createdAt,
  }
}

const readOnly = { readOnly: true }

export const searchFields = ({ defaultFields }: { defaultFields: Field[] }): Field[] => [
  ...defaultFields,
  { name: 'slug', label: 'Slug', type: 'text', index: true, admin: readOnly },
  { name: 'subtitle', label: 'Linha fina', type: 'text', admin: readOnly },
  { name: 'summary', label: 'Síntese', type: 'textarea', admin: readOnly },
  { name: 'tagNames', label: 'Tags', type: 'text', admin: readOnly },
  {
    name: 'body',
    label: 'Corpo (texto puro)',
    type: 'textarea',
    admin: { ...readOnly, hidden: true },
  },
  { name: 'publishedAt', label: 'Publicado em', type: 'date', index: true, admin: readOnly },
]

/** Pesos do índice de texto: título vale mais que a síntese, que vale mais que o corpo. */
export const SEARCH_TEXT_INDEX = {
  name: 'busca_texto_pt',
  keys: { title: 'text', tagNames: 'text', subtitle: 'text', summary: 'text', body: 'text' },
  options: {
    default_language: 'portuguese',
    weights: { title: 10, tagNames: 6, subtitle: 4, summary: 4, body: 1 },
  },
} as const

type MongoCollection = {
  createIndex: (keys: object, options: object) => Promise<string>
  indexes: () => Promise<{ name: string; key: Record<string, unknown> }[]>
  dropIndex: (name: string) => Promise<unknown>
}

function rawSearchCollection(payload: Payload): MongoCollection | null {
  const models = (
    payload.db as unknown as { collections?: Record<string, { collection: MongoCollection }> }
  ).collections
  return models?.[SEARCH_SLUG]?.collection ?? null
}

/** Cria (ou recria, se a definição mudou) o índice de texto. Idempotente. */
export async function ensureSearchTextIndex(payload: Payload): Promise<void> {
  const col = rawSearchCollection(payload)
  if (!col) return
  const { name, keys, options } = SEARCH_TEXT_INDEX
  const current = (await col.indexes().catch(() => [])).find((i) => i.key?._fts === 'text')
  if (current && current.name !== name) await col.dropIndex(current.name)
  try {
    await col.createIndex(keys, { ...options, name })
  } catch (err) {
    // IndexOptionsConflict: mesma chave, opções novas (ex.: pesos mudaram)
    if ((err as { code?: number }).code === 85 || (err as { code?: number }).code === 86) {
      await col.dropIndex(name)
      await col.createIndex(keys, { ...options, name })
    } else {
      throw err
    }
  }
}
