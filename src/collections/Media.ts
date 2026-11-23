import type { CollectionConfig } from 'payload'

import { anyone, authenticated } from '../access'

/**
 * Imagens do blog. Por enquanto em disco local; no passo 3 vão pro MinIO
 * (storage-s3) com os tamanhos thumb 400, card 800, hero 1600 e og 1200×630 em WebP.
 */
export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: 'Mídia', plural: 'Mídias' },
  access: { read: anyone, create: authenticated, update: authenticated, delete: authenticated },
  admin: {
    group: 'Conteúdo',
    useAsTitle: 'alt',
    defaultColumns: ['filename', 'alt', 'updatedAt'],
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
  },
}
