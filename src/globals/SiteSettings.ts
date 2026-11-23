import type { GlobalConfig } from 'payload'

import { anyone, authenticated } from '../access'
import { revalidateSiteAfterChange } from '../lib/revalidate'

export const SOCIAL_NETWORKS = [
  'x',
  'github',
  'linkedin',
  'instagram',
  'youtube',
  'bluesky',
  'email',
  'outro',
] as const

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  hooks: { afterChange: [revalidateSiteAfterChange] },
  label: 'Configurações do site',
  access: { read: anyone, update: authenticated },
  admin: { group: 'Configurações' },
  fields: [
    {
      name: 'siteName',
      label: 'Nome do site',
      type: 'text',
      required: true,
      defaultValue: 'Pronto, Falei!',
    },
    {
      name: 'tagline',
      label: 'Tagline',
      type: 'text',
      defaultValue: 'Ideias, opiniões e descobertas, sem rodeios.',
    },
    {
      name: 'author',
      label: 'Autor (página Sobre)',
      type: 'group',
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'name',
              label: 'Nome',
              type: 'text',
              defaultValue: 'Wilson Lima',
              admin: { width: '50%' },
            },
            {
              name: 'role',
              label: 'Linha curta',
              type: 'text',
              defaultValue: 'Engenheiro de software fullstack em Brasília',
              admin: { width: '50%' },
            },
          ],
        },
        {
          name: 'photo',
          label: 'Foto',
          type: 'upload',
          relationTo: 'media',
          admin: { description: 'Quadrada de preferência. Sem foto, aparecem as iniciais.' },
        },
        {
          name: 'bio',
          label: 'Bio curta',
          type: 'textarea',
          maxLength: 400,
          admin: { description: 'Duas ou três frases. Aparece no topo do /sobre.' },
        },
        { name: 'email', label: 'E-mail público', type: 'email' },
      ],
    },
    {
      name: 'social',
      label: 'Redes sociais',
      labels: { singular: 'Rede', plural: 'Redes' },
      type: 'array',
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'network',
              label: 'Rede',
              type: 'select',
              required: true,
              options: SOCIAL_NETWORKS.map((value) => ({ label: value, value })),
              admin: { width: '30%' },
            },
            { name: 'url', label: 'URL', type: 'text', required: true, admin: { width: '70%' } },
          ],
        },
      ],
    },
    {
      name: 'llmsTxtIntro',
      label: 'Texto do llms.txt',
      type: 'textarea',
      admin: { description: 'Descrição do blog no topo do /llms.txt (passo 7).' },
    },
    {
      name: 'aiRobots',
      label: 'Robôs de IA no robots.txt',
      type: 'select',
      defaultValue: 'allow',
      required: true,
      options: [
        { label: 'Liberar (GPTBot, ClaudeBot e afins)', value: 'allow' },
        { label: 'Bloquear', value: 'block' },
      ],
    },
  ],
}
