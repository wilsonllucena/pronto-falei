/**
 * Hooks do Payload que invalidam o cache do Next quando o conteúdo muda.
 * Fora de um servidor Next (seed, testes, scripts) não há o que invalidar,
 * então é um no-op silencioso.
 */
import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  GlobalAfterChangeHook,
} from 'payload'

import { CACHE_TAGS, postChangeTags } from './cacheTags'

type Revalidator = (tag: string) => void

let override: Revalidator | null = null

/** Só pra teste: troca a função que invalida. */
export function setRevalidator(fn: Revalidator | null) {
  override = fn
}

export async function revalidateTags(tags: string[]): Promise<void> {
  if (override) {
    tags.forEach(override)
    return
  }
  if (!process.env.NEXT_RUNTIME) return
  try {
    const { revalidateTag } = await import('next/cache')
    // expire: 0 — a próxima visita já busca o dado novo.
    for (const tag of tags) revalidateTag(tag, { expire: 0 })
  } catch (err) {
    // Alguns fluxos do admin gravam durante o render de uma página, onde o Next
    // não deixa invalidar. Aí vale a validade de segurança do cache (1h).
    const msg = err instanceof Error ? err.message : String(err)
    console.warn('[cache] não deu pra invalidar', tags.join(', '), '—', msg.split('\n')[0])
  }
}

export const revalidatePostAfterChange: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  context,
}) => {
  if (!context?.disableRevalidate) await revalidateTags(postChangeTags(doc, previousDoc))
  return doc
}

export const revalidatePostAfterDelete: CollectionAfterDeleteHook = async ({ doc, context }) => {
  if (!context?.disableRevalidate) await revalidateTags(postChangeTags(doc))
  return doc
}

/** Tags, categorias e mídias aparecem nos cards e no post: invalida as listas e os posts. */
export const revalidateListsAfterChange: CollectionAfterChangeHook = async ({ doc, context }) => {
  if (!context?.disableRevalidate) await revalidateTags([CACHE_TAGS.posts, CACHE_TAGS.feeds])
  return doc
}

export const revalidateListsAfterDelete: CollectionAfterDeleteHook = async ({ doc, context }) => {
  if (!context?.disableRevalidate) await revalidateTags([CACHE_TAGS.posts, CACHE_TAGS.feeds])
  return doc
}

export const revalidateSiteAfterChange: GlobalAfterChangeHook = async ({ doc, context }) => {
  if (!context?.disableRevalidate) await revalidateTags([CACHE_TAGS.site, CACHE_TAGS.feeds])
  return doc
}

/** Páginas (Sobre e afins): invalida as páginas e os feeds. */
export const revalidatePagesAfterChange: CollectionAfterChangeHook = async ({ doc, context }) => {
  if (!context?.disableRevalidate) await revalidateTags([CACHE_TAGS.pages, CACHE_TAGS.feeds])
  return doc
}

export const revalidatePagesAfterDelete: CollectionAfterDeleteHook = async ({ doc, context }) => {
  if (!context?.disableRevalidate) await revalidateTags([CACHE_TAGS.pages, CACHE_TAGS.feeds])
  return doc
}

export const revalidateRedirectsAfterChange: CollectionAfterChangeHook = async ({
  doc,
  context,
}) => {
  if (!context?.disableRevalidate) await revalidateTags([CACHE_TAGS.redirects])
  return doc
}

export const revalidateRedirectsAfterDelete: CollectionAfterDeleteHook = async ({
  doc,
  context,
}) => {
  if (!context?.disableRevalidate) await revalidateTags([CACHE_TAGS.redirects])
  return doc
}
