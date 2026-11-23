import type { CollectionConfig } from 'payload'

import { authenticated, authenticatedOrPublished } from '../access'
import { contentEditor } from '../fields/editor'
import { seoTab } from '../fields/seo'
import { slug } from '../fields/slug'

/** Páginas editáveis: Sobre, Uses, Contato. */
export const Pages: CollectionConfig = {
  slug: 'pages',
  labels: { singular: 'Página', plural: 'Páginas' },
  access: {
    read: authenticatedOrPublished,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  admin: {
    group: 'Conteúdo',
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', '_status', 'updatedAt'],
  },
  versions: {
    drafts: { autosave: { interval: 1500 } },
    maxPerDoc: 30,
  },
  fields: [
    { name: 'title', label: 'Título', type: 'text', required: true },
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Conteúdo',
          fields: [{ name: 'content', label: 'Texto', type: 'richText', editor: contentEditor }],
        },
        seoTab,
      ],
    },
    slug('title'),
  ],
}
