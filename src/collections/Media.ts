import type { CollectionConfig } from 'payload'

/**
 * Placeholder do passo 1. No passo 3 o storage vai pro MinIO (storage-s3),
 * com tamanhos de imagem (thumb, card, hero, og) e campos de legenda/crédito.
 */
export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: 'Mídia', plural: 'Mídias' },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'alt',
      label: 'Texto alternativo',
      type: 'text',
      required: true,
    },
  ],
  upload: {
    mimeTypes: ['image/*'],
  },
}
