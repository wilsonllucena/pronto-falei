import {
  BlocksFeature,
  FixedToolbarFeature,
  lexicalEditor,
  UploadFeature,
} from '@payloadcms/richtext-lexical'

import { contentBlocks } from '../blocks'

/**
 * Editor Lexical dos posts e páginas: recursos padrão + blocos
 * Código, Destaque, Embed e Citação, e imagem (Media) com legenda.
 * O render no site chega no passo 5.
 */
export const contentEditor = lexicalEditor({
  features: ({ defaultFeatures }) => [
    ...defaultFeatures,
    FixedToolbarFeature(),
    BlocksFeature({ blocks: contentBlocks }),
    UploadFeature({
      collections: {
        media: {
          fields: [{ name: 'caption', label: 'Legenda', type: 'text' }],
        },
      },
    }),
  ],
})
