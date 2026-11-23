import type { CollectionConfig } from 'payload'

import { authenticated, authenticatedOrPublished } from '../access'
import { contentEditor } from '../fields/editor'
import { seoTab } from '../fields/seo'
import { slug } from '../fields/slug'
import { computeReadingStats, setPublishedAt } from '../hooks/postStats'
import {
  KEY_POINT_MAX,
  KEY_POINTS_MAX,
  KEY_POINTS_MIN,
  SUMMARY_MAX,
  SUMMARY_MIN,
  SUMMARY_SOURCES,
  validateSummaryReviewed,
} from '../lib/summary'

export const Posts: CollectionConfig = {
  slug: 'posts',
  labels: { singular: 'Post', plural: 'Posts' },
  access: {
    read: authenticatedOrPublished,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  admin: {
    group: 'Conteúdo',
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', '_status', 'publishedAt', 'updatedAt'],
    listSearchableFields: ['title', 'subtitle', 'summary'],
  },
  defaultSort: '-publishedAt',
  versions: {
    drafts: {
      autosave: { interval: 1500 },
      schedulePublish: true,
    },
    maxPerDoc: 50,
  },
  hooks: {
    beforeChange: [computeReadingStats, setPublishedAt],
  },
  fields: [
    { name: 'title', label: 'Título', type: 'text', required: true },
    {
      name: 'subtitle',
      label: 'Linha fina',
      type: 'text',
      maxLength: 200,
    },
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Conteúdo',
          fields: [
            { name: 'cover', label: 'Capa', type: 'upload', relationTo: 'media' },
            {
              name: 'content',
              label: 'Texto',
              type: 'richText',
              editor: contentEditor,
              required: true,
            },
          ],
        },
        {
          label: 'Síntese',
          description:
            'TL;DR e pontos-chave: aparecem no topo do post, no feed, na busca, no OG, no JSON-LD e no .md.',
          fields: [
            {
              name: 'summary',
              label: 'Síntese (TL;DR)',
              type: 'textarea',
              required: true,
              minLength: SUMMARY_MIN,
              maxLength: SUMMARY_MAX,
              admin: {
                description: `Entre ${SUMMARY_MIN} e ${SUMMARY_MAX} caracteres. Obrigatória pra publicar.`,
              },
            },
            {
              name: 'keyPoints',
              label: 'Pontos-chave',
              labels: { singular: 'Ponto-chave', plural: 'Pontos-chave' },
              type: 'array',
              required: true,
              minRows: KEY_POINTS_MIN,
              maxRows: KEY_POINTS_MAX,
              admin: { description: `De ${KEY_POINTS_MIN} a ${KEY_POINTS_MAX} itens.` },
              fields: [
                {
                  name: 'text',
                  label: 'Ponto',
                  type: 'text',
                  required: true,
                  maxLength: KEY_POINT_MAX,
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'summarySource',
                  label: 'Origem da síntese',
                  type: 'select',
                  defaultValue: 'manual',
                  required: true,
                  options: [...SUMMARY_SOURCES],
                  admin: { width: '50%' },
                },
                {
                  name: 'summaryReviewed',
                  label: 'Síntese revisada',
                  type: 'checkbox',
                  defaultValue: false,
                  validate: (
                    value: unknown,
                    { siblingData }: { siblingData: Record<string, unknown> },
                  ) => validateSummaryReviewed(value, siblingData?.summarySource),
                  admin: {
                    width: '50%',
                    description: 'Obrigatória quando a origem é IA.',
                  },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'summaryModel',
                  label: 'Modelo que gerou',
                  type: 'text',
                  admin: { readOnly: true, width: '50%' },
                },
                {
                  name: 'summaryGeneratedAt',
                  label: 'Gerada em',
                  type: 'date',
                  admin: {
                    readOnly: true,
                    width: '50%',
                    date: { pickerAppearance: 'dayAndTime' },
                  },
                },
              ],
            },
          ],
        },
        {
          label: 'Relacionados',
          fields: [
            {
              name: 'relatedPosts',
              label: 'Posts relacionados (override manual)',
              type: 'relationship',
              relationTo: 'posts',
              hasMany: true,
              filterOptions: ({ id }) => (id ? { id: { not_in: [id] } } : true),
              admin: {
                description: 'Se vazio, o site escolhe por tags em comum.',
              },
            },
          ],
        },
        seoTab,
      ],
    },
    slug('title'),
    {
      name: 'publishedAt',
      label: 'Publicado em',
      type: 'date',
      index: true,
      admin: {
        position: 'sidebar',
        date: { pickerAppearance: 'dayAndTime' },
        description: 'Preenchido na primeira publicação, se vazio.',
      },
    },
    {
      name: 'category',
      label: 'Categoria',
      type: 'relationship',
      relationTo: 'categories',
      admin: { position: 'sidebar' },
    },
    {
      name: 'tags',
      label: 'Tags',
      type: 'relationship',
      relationTo: 'tags',
      hasMany: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'featured',
      label: 'Destaque na home',
      type: 'checkbox',
      defaultValue: false,
      index: true,
      admin: { position: 'sidebar' },
    },
    {
      type: 'row',
      admin: { position: 'sidebar' },
      fields: [
        {
          name: 'readingTime',
          label: 'Leitura (min)',
          type: 'number',
          admin: { readOnly: true, width: '50%' },
        },
        {
          name: 'wordCount',
          label: 'Palavras',
          type: 'number',
          admin: { readOnly: true, width: '50%' },
        },
      ],
    },
  ],
}
