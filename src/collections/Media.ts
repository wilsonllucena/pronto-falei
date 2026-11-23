import type { CollectionConfig } from 'payload'

import { revalidateListsAfterChange, revalidateListsAfterDelete } from '../lib/revalidate'

import { anyone, authenticated } from '../access'

/** Tamanhos gerados em WebP a cada upload (plano: thumb 400, card 800, hero 1600, og 1200×630). */
export const IMAGE_SIZES = [
  { name: 'thumb', width: 400 },
  { name: 'card', width: 800 },
  { name: 'hero', width: 1600 },
  { name: 'og', width: 1200, height: 630 },
] as const

export const WEBP_QUALITY = 80

/**
 * Imagens do blog, guardadas no MinIO (bucket pronto-falei-media, pasta media/)
 * via @payloadcms/storage-s3. Alt é obrigatório.
 */
export const Media: CollectionConfig = {
  slug: 'media',
  hooks: {
    afterChange: [revalidateListsAfterChange],
    afterDelete: [revalidateListsAfterDelete],
  },
  labels: { singular: 'Mídia', plural: 'Mídias' },
  access: { read: anyone, create: authenticated, update: authenticated, delete: authenticated },
  admin: {
    group: 'Conteúdo',
    useAsTitle: 'alt',
    defaultColumns: ['filename', 'alt', 'width', 'height', 'updatedAt'],
  },
  fields: [
    {
      name: 'alt',
      label: 'Texto alternativo',
      type: 'text',
      required: true,
      admin: { description: 'Descreva a imagem pra quem usa leitor de tela.' },
    },
    { name: 'caption', label: 'Legenda', type: 'text' },
    { name: 'credit', label: 'Crédito', type: 'text' },
  ],
  upload: {
    mimeTypes: ['image/*'],
    focalPoint: true,
    adminThumbnail: 'thumb',
    imageSizes: IMAGE_SIZES.map((size) => ({
      ...size,
      // og sempre sai em 1200×630 (amplia se precisar); os outros nunca ampliam.
      withoutEnlargement: !('height' in size),
      formatOptions: { format: 'webp' as const, options: { quality: WEBP_QUALITY } },
    })),
  },
}
