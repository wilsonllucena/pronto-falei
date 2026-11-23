import type { CollectionConfig } from 'payload'

import { anyone, authenticated } from '../access'
import { slug } from '../fields/slug'

export const Tags: CollectionConfig = {
  slug: 'tags',
  labels: { singular: 'Tag', plural: 'Tags' },
  access: { read: anyone, create: authenticated, update: authenticated, delete: authenticated },
  admin: {
    group: 'Taxonomia',
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'updatedAt'],
  },
  defaultSort: 'name',
  fields: [
    { name: 'name', label: 'Nome', type: 'text', required: true, unique: true },
    slug('name'),
    { name: 'description', label: 'Descrição', type: 'textarea', maxLength: 300 },
  ],
}
