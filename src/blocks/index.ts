import type { Block } from 'payload'

export const CODE_LANGUAGES = [
  'text',
  'bash',
  'typescript',
  'javascript',
  'tsx',
  'json',
  'python',
  'go',
  'php',
  'sql',
  'yaml',
  'dockerfile',
  'html',
  'css',
  'markdown',
] as const

export const CodeBlock: Block = {
  slug: 'code',
  labels: { singular: 'Código', plural: 'Códigos' },
  interfaceName: 'CodeBlock',
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'language',
          label: 'Linguagem',
          type: 'select',
          defaultValue: 'typescript',
          required: true,
          options: CODE_LANGUAGES.map((value) => ({ label: value, value })),
          admin: { width: '40%' },
        },
        {
          name: 'title',
          label: 'Título (ex.: nome do arquivo)',
          type: 'text',
          admin: { width: '60%' },
        },
      ],
    },
    { name: 'code', label: 'Código', type: 'code', required: true },
  ],
}

export const CalloutBlock: Block = {
  slug: 'callout',
  labels: { singular: 'Destaque', plural: 'Destaques' },
  interfaceName: 'CalloutBlock',
  fields: [
    {
      name: 'tone',
      label: 'Tom',
      type: 'select',
      defaultValue: 'info',
      required: true,
      options: [
        { label: 'Info', value: 'info' },
        { label: 'Dica', value: 'dica' },
        { label: 'Atenção', value: 'atencao' },
        { label: 'Perigo', value: 'perigo' },
      ],
    },
    { name: 'title', label: 'Título', type: 'text' },
    { name: 'content', label: 'Texto', type: 'textarea', required: true },
  ],
}

const EMBED_HOSTS = ['youtube.com', 'www.youtube.com', 'youtu.be', 'x.com', 'twitter.com']

export const validateEmbedUrl = (value: unknown): true | string => {
  if (typeof value !== 'string' || !value) return 'Informe a URL'
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:') return 'Use uma URL https'
    if (!EMBED_HOSTS.includes(url.hostname)) return 'Só YouTube ou X (Twitter)'
    return true
  } catch {
    return 'URL inválida'
  }
}

export const EmbedBlock: Block = {
  slug: 'embed',
  labels: { singular: 'Embed (YouTube/X)', plural: 'Embeds' },
  interfaceName: 'EmbedBlock',
  fields: [
    {
      name: 'url',
      label: 'URL',
      type: 'text',
      required: true,
      validate: (value: unknown) => validateEmbedUrl(value),
    },
    { name: 'caption', label: 'Legenda', type: 'text' },
  ],
}

export const QuoteBlock: Block = {
  slug: 'quote',
  labels: { singular: 'Citação', plural: 'Citações' },
  interfaceName: 'QuoteBlock',
  fields: [
    { name: 'text', label: 'Citação', type: 'textarea', required: true },
    { name: 'author', label: 'Autor', type: 'text' },
    { name: 'sourceUrl', label: 'Link da fonte', type: 'text' },
  ],
}

export const contentBlocks: Block[] = [CodeBlock, CalloutBlock, EmbedBlock, QuoteBlock]
