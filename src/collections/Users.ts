import type { CollectionConfig } from 'payload'

/**
 * Usuários do admin. No blog só o Wilson é usuário (admin);
 * não existe cadastro público. Campos de autor (avatar, bio) entram no passo 2.
 */
export const Users: CollectionConfig = {
  slug: 'users',
  labels: { singular: 'Usuário', plural: 'Usuários' },
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['name', 'email', 'updatedAt'],
  },
  auth: true,
  fields: [
    {
      name: 'name',
      label: 'Nome',
      type: 'text',
    },
  ],
}
