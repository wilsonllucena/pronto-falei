import type { Access, FieldAccess } from 'payload'

/** Qualquer visitante. */
export const anyone: Access = () => true

/** Só quem está logado no admin (no blog: só o Wilson). */
export const authenticated: Access = ({ req: { user } }) => Boolean(user)

export const authenticatedField: FieldAccess = ({ req: { user } }) => Boolean(user)

/** Visitante vê só o que está publicado; logado vê tudo, inclusive rascunhos. */
export const authenticatedOrPublished: Access = ({ req: { user } }) => {
  if (user) return true
  return { _status: { equals: 'published' } }
}
