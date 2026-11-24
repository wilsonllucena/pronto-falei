import type { CollectionConfig } from 'payload'

import { revalidateListsAfterChange, revalidateListsAfterDelete } from '../lib/revalidate'

import { anyone, authenticated } from '../access'
import { slug } from '../fields/slug'

/** Série de posts: a ordem da lista é a ordem de leitura (Parte 1, 2, 3…). */
export const Series: CollectionConfig = {
  slug: 'series',
  hooks: {
    afterChange: [revalidateListsAfterChange],
    afterDelete: [revalidateListsAfterDelete],
  },
  labels: { singular: 'Série', plural: 'Séries' },
  access: { read: anyone, create: authenticated, update: authenticated, delete: authenticated },
  admin: {
    group: 'Conteúdo',
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'updatedAt'],
    description: 'Posts lidos em sequência. No post aparece "Parte N de M" com anterior e próximo.',
  },
  defaultSort: 'title',
  fields: [
    { name: 'title', label: 'Título', type: 'text', required: true, unique: true },
    slug('title'),
    { name: 'description', label: 'Descrição', type: 'textarea', maxLength: 300 },
    {
      name: 'posts',
      label: 'Posts, na ordem de leitura',
      type: 'relationship',
      relationTo: 'posts',
      hasMany: true,
      required: true,
      minRows: 2,
      admin: {
        isSortable: true,
        description:
          'Arraste pra mudar a ordem. Rascunhos ficam de fora no site até serem publicados. Se um post estiver em mais de uma série, vale a criada primeiro.',
      },
    },
  ],
}
