import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { seoPlugin } from '@payloadcms/plugin-seo'
import { s3Storage } from '@payloadcms/storage-s3'
import { pt } from '@payloadcms/translations/languages/pt'
import path from 'path'
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { Categories } from './collections/Categories'
import { Media } from './collections/Media'
import { Pages } from './collections/Pages'
import { Posts } from './collections/Posts'
import { Tags } from './collections/Tags'
import { Users } from './collections/Users'
import { healthEndpoint } from './endpoints/health'
import { contentEditor } from './fields/editor'
import { Navigation } from './globals/Navigation'
import { SiteSettings } from './globals/SiteSettings'
import { seoDescription, seoTitle } from './lib/seo'
import { buildPublicFileURL, getStorageSettings, MEDIA_PREFIX } from './lib/storage'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const isBuild = process.env.NEXT_PHASE === 'phase-production-build'
const storage = getStorageSettings()
const mediaPublicUrl = storage.publicUrl

export default buildConfig({
  serverURL: process.env.NEXT_PUBLIC_SERVER_URL || '',
  admin: {
    user: Users.slug,
    meta: {
      titleSuffix: ' · Pronto, Falei!',
    },
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Posts, Pages, Media, Tags, Categories, Users],
  globals: [SiteSettings, Navigation],
  editor: contentEditor,
  // Blog só em pt-BR: o admin também.
  i18n: {
    supportedLanguages: { pt },
    fallbackLanguage: 'pt',
  },
  endpoints: [healthEndpoint],
  // Fila de jobs: por enquanto só o agendamento de publicação (schedulePublish).
  // A fila `ai` da síntese entra no passo 8.
  jobs: {
    autoRun: [{ cron: '* * * * *', queue: 'default', limit: 10 }],
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
    seoPlugin({
      generateTitle: ({ doc }) => seoTitle(doc as { title?: string }),
      generateDescription: ({ doc }) =>
        seoDescription(doc as { summary?: string; subtitle?: string }),
    }),
  ],
})
