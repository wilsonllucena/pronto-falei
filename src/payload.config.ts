import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { redirectsPlugin } from '@payloadcms/plugin-redirects'
import { searchPlugin } from '@payloadcms/plugin-search'
import { seoPlugin } from '@payloadcms/plugin-seo'
import { s3Storage } from '@payloadcms/storage-s3'
import { pt } from '@payloadcms/translations/languages/pt'
import path from 'path'
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { Categories } from './collections/Categories'
import { Series } from './collections/Series'
import { Media } from './collections/Media'
import { Pages } from './collections/Pages'
import { Posts } from './collections/Posts'
import { Tags } from './collections/Tags'
import { Users } from './collections/Users'
import { moderateCommentEndpoint, recentCommentsEndpoint } from './endpoints/comentarios'
import { healthEndpoint } from './endpoints/health'
import { subscribeEndpoint } from './endpoints/newsletter'
import { AI_QUEUE, generateSummaryTask } from './jobs/generateSummary'
import { contentEditor } from './fields/editor'
import { Navigation } from './globals/Navigation'
import { SiteSettings } from './globals/SiteSettings'
import { allowedOrigins } from './lib/origins'
import { normalizePath } from './lib/redirects'
import { revalidateRedirectsAfterChange, revalidateRedirectsAfterDelete } from './lib/revalidate'
import { seoDescription, seoTitle } from './lib/seo'
import { buildPublicFileURL, getStorageSettings, MEDIA_PREFIX } from './lib/storage'
import { beforeSync, ensureSearchTextIndex, searchFields, SEARCH_SLUG } from './plugins/search'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const isBuild = process.env.NEXT_PHASE === 'phase-production-build'
const storage = getStorageSettings()
const mediaPublicUrl = storage.publicUrl

export default buildConfig({
  // PAYLOAD_SERVER_URL vazio (produção na LAN + Tailscale) deixa as URLs das
  // imagens relativas (/api/media/file/…), então funcionam em qualquer origem.
  serverURL: process.env['PAYLOAD_SERVER_URL'] ?? (process.env.NEXT_PUBLIC_SERVER_URL || ''),
  // CSRF do cookie de login e CORS da API só pras origens configuradas
  // (PAYLOAD_ALLOWED_ORIGINS; sem ela, a origem da NEXT_PUBLIC_SERVER_URL).
  csrf: allowedOrigins(),
  cors: allowedOrigins(),
  admin: {
    user: Users.slug,
    meta: {
      titleSuffix: ' · Pronto, Falei!',
    },
    importMap: {
      baseDir: path.resolve(dirname),
    },
    components: {
      afterNavLinks: ['/components/admin/ComentariosNavLink#ComentariosNavLink'],
      views: {
        comentarios: {
          Component: '/components/admin/ComentariosView#ComentariosView',
          path: '/comentarios',
        },
      },
    },
  },
  collections: [Posts, Series, Pages, Media, Tags, Categories, Users],
  globals: [SiteSettings, Navigation],
  editor: contentEditor,
  // Blog só em pt-BR: o admin também.
  i18n: {
    supportedLanguages: { pt },
    fallbackLanguage: 'pt',
  },
  endpoints: [healthEndpoint, recentCommentsEndpoint, moderateCommentEndpoint, subscribeEndpoint],
  // Índice de texto em português da busca (idempotente; fora do build).
  onInit: async (payload) => {
    if (isBuild) return
    await ensureSearchTextIndex(payload).catch((err) =>
      payload.logger.error({ err, msg: '[busca] não deu pra criar o índice de texto' }),
    )
  },
  // Fila de jobs: `default` pro agendamento de publicação (schedulePublish) e
  // `ai` pra síntese com a IA local (um post por vez; o endpoint já dispara o
  // job, o autoRun a cada 30 s pega o que sobrar).
  jobs: {
    tasks: [generateSummaryTask],
    enableConcurrencyControl: true,
    // mantém o job concluído: o botão do admin lê o resultado dele no status
    deleteJobOnComplete: false,
    autoRun: [
      { cron: '* * * * *', queue: 'default', limit: 10 },
      { cron: '*/30 * * * * *', queue: AI_QUEUE, limit: 1 },
    ],
    shouldAutoRun: () => !isBuild && process.env.PAYLOAD_JOBS_AUTORUN !== 'false',
  },
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: mongooseAdapter({
    url: process.env.DATABASE_URI || '',
    // Cria coleções e índices na subida, antes da primeira escrita: evita o erro
    // "catalog changes" de transação num banco novo.
    ensureIndexes: true,
  }),
  sharp,
  telemetry: false,
  plugins: [
    // Imagens no MinIO (Silo). Com MEDIA_PUBLIC_URL, a URL aponta direto pro
    // bucket público (subdomínio de imagens com cache do Cloudflare no passo 14).
    s3Storage({
      enabled: storage.enabled,
      bucket: storage.bucket,
      collections: {
        media: {
          prefix: MEDIA_PREFIX,
          ...(mediaPublicUrl
            ? {
                disablePayloadAccessControl: true as const,
                generateFileURL: ({ filename, prefix }) =>
                  buildPublicFileURL(mediaPublicUrl, prefix, filename),
              }
            : {}),
        },
      },
      config: {
        endpoint: storage.endpoint,
        region: storage.region,
        forcePathStyle: storage.forcePathStyle,
        credentials: {
          accessKeyId: storage.accessKeyId,
          secretAccessKey: storage.secretAccessKey,
        },
      },
    }),
    // Busca: só posts publicados entram no índice (rascunho sai).
    searchPlugin({
      collections: ['posts'],
      defaultPriorities: { posts: 10 },
      beforeSync,
      searchOverrides: {
        slug: SEARCH_SLUG,
        labels: { singular: 'Resultado da busca', plural: 'Índice da busca' },
        admin: {
          group: 'Configurações',
          description:
            'Gerado sozinho a partir dos posts publicados. Use "Reindexar" se algo sair do lugar.',
        },
        fields: searchFields,
      },
    }),
    // Redirecionamentos 301/302 (URLs antigas, slugs trocados).
    redirectsPlugin({
      collections: ['posts', 'pages'],
      redirectTypes: ['301', '302'],
      redirectTypeFieldOverride: { defaultValue: '301' },
      overrides: {
        labels: { singular: 'Redirecionamento', plural: 'Redirecionamentos' },
        admin: {
          group: 'Configurações',
          useAsTitle: 'from',
          defaultColumns: ['from', 'to.type', 'type', 'updatedAt'],
        },
        hooks: {
          afterChange: [revalidateRedirectsAfterChange],
          afterDelete: [revalidateRedirectsAfterDelete],
        },
        fields: ({ defaultFields }) =>
          defaultFields.map((f) =>
            f.type === 'text' && f.name === 'from'
              ? {
                  ...f,
                  admin: {
                    ...f.admin,
                    description: 'Caminho antigo, ex.: /2024/meu-post-antigo (sem o domínio).',
                  },
                  hooks: {
                    beforeValidate: [
                      ({ value }: { value?: unknown }) =>
                        typeof value === 'string' ? normalizePath(value) : value,
                    ],
                  },
                }
              : f,
          ),
      },
    }),
    seoPlugin({
      generateTitle: ({ doc }) => seoTitle(doc as { title?: string }),
      generateDescription: ({ doc }) =>
        seoDescription(doc as { summary?: string; subtitle?: string }),
    }),
  ],
})
