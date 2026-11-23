/**
 * Slug em ASCII pra URLs em pt-BR: "Opinião sem rodeios!" → "opiniao-sem-rodeios".
 */
export function toSlug(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const slug = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' e ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
  return slug || undefined
}
