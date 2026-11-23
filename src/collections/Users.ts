import type { CollectionConfig } from 'payload'

import { authenticated } from '../access'

/**
 * Usuários do admin. No blog só o Wilson é usuário (admin): não há cadastro
 * público e só quem está logado cria/vê usuários. Nome, avatar e bio
 * alimentam o autor no JSON-LD (passo 7).
 */
export const Users: CollectionConfig = {
  slug: 'users',
  labels: { singular: 'Usuário', plural: 'Usuários' },
  access: {
    read: authenticated,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  admin: {
    group: 'Admin',
    useAsTitle: 'email',
    defaultColumns: ['name', 'email', 'updatedAt'],
  },
  auth: true,
  fields: [
    { name: 'name', label: 'Nome', type: 'text' },
    { name: 'avatar', label: 'Avatar', type: 'upload', relationTo: 'media' },
    { name: 'bio', label: 'Bio curta', type: 'textarea', maxLength: 500 },
  ],
}
