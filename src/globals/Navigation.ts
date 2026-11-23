import type { Field, GlobalConfig } from 'payload'

import { anyone, authenticated } from '../access'

const navItems = (name: string, label: string): Field => ({
  name,
  label,
  labels: { singular: 'Item', plural: 'Itens' },
  type: 'array',
  maxRows: 8,
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'label', label: 'Texto', type: 'text', required: true, admin: { width: '40%' } },
        {
          name: 'url',
          label: 'Link',
          type: 'text',
          required: true,
          admin: { width: '45%', description: 'Caminho interno (/sobre) ou URL completa' },
        },
        { name: 'newTab', label: 'Nova aba', type: 'checkbox', admin: { width: '15%' } },
      ],
    },
  ],
})

export const Navigation: GlobalConfig = {
  slug: 'navigation',
  label: 'Navegação',
  access: { read: anyone, update: authenticated },
  admin: { group: 'Configurações' },
  fields: [navItems('header', 'Itens do header'), navItems('footer', 'Itens do footer')],
}
