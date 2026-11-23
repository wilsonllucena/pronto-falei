import type { CollectionConfig } from 'payload'

import { anyone, authenticated } from '../access'
import { slug } from '../fields/slug'

export const validateHexColor = (value: unknown): true | string => {
  if (value === undefined || value === null || value === '') return true
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)
    ? true
    : 'Use uma cor hex no formato #RRGGBB'
}

export const Categories: CollectionConfig = {
  slug: 'categories',
  labels: { singular: 'Categoria', plural: 'Categorias' },
  access: { read: anyone, create: authenticated, update: authenticated, delete: authenticated },
  admin: {
    group: 'Taxonomia',
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'color', 'updatedAt'],
    description: 'Ex.: Opinião, Tutorial, Diário.',
  },
  defaultSort: 'name',
  fields: [
    { name: 'name', label: 'Nome', type: 'text', required: true, unique: true },
    slug('name'),
    { name: 'description', label: 'Descrição', type: 'textarea', maxLength: 300 },
    {
      name: 'color',
      label: 'Cor',
      type: 'text',
      defaultValue: '#D9480F',
      validate: (value: unknown) => validateHexColor(value),
      admin: { description: 'Hex #RRGGBB, usada no selo da categoria.' },
    },
  ],
}
