import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3'

/** Configuração do MinIO (S3) lida do ambiente. */
export type StorageSettings = {
  enabled: boolean
  bucket: string
  endpoint?: string
  region: string
  forcePathStyle: boolean
  accessKeyId: string
  secretAccessKey: string
  /** Base pública das imagens (ex.: https://img.dominio ou http://localhost:3131/pronto-falei-media). */
  publicUrl?: string
}

export const MEDIA_PREFIX = 'media'

export function getStorageSettings(env: NodeJS.ProcessEnv = process.env): StorageSettings {
  const bucket = env.S3_BUCKET || ''
  const accessKeyId = env.S3_ACCESS_KEY_ID || ''
  const secretAccessKey = env.S3_SECRET_ACCESS_KEY || ''
  return {
    enabled: Boolean(bucket && accessKeyId && secretAccessKey),
    bucket,
    endpoint: env.S3_ENDPOINT || undefined,
    region: env.S3_REGION || 'us-east-1',
    forcePathStyle: env.S3_FORCE_PATH_STYLE !== 'false',
    accessKeyId,
    secretAccessKey,
    publicUrl: env.MEDIA_PUBLIC_URL ? env.MEDIA_PUBLIC_URL.replace(/\/+$/, '') : undefined,
  }
}

/** URL pública de um arquivo: base + prefixo (pasta do objeto) + nome. */
export function buildPublicFileURL(
  base: string,
  prefix: string | undefined,
  filename: string,
): string {
  const path = [prefix, filename]
    .filter(Boolean)
    .join('/')
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/')
  return `${base.replace(/\/+$/, '')}/${path}`
}

let client: S3Client | undefined

export function getS3Client(settings: StorageSettings = getStorageSettings()): S3Client {
  if (!client) {
    client = new S3Client({
      endpoint: settings.endpoint,
      region: settings.region,
      forcePathStyle: settings.forcePathStyle,
      credentials: {
        accessKeyId: settings.accessKeyId,
        secretAccessKey: settings.secretAccessKey,
      },
    })
  }
  return client
}

/** true se o bucket existe e as credenciais do app conseguem acessá-lo. */
export async function bucketExists(
  settings: StorageSettings = getStorageSettings(),
): Promise<boolean> {
  if (!settings.enabled) return false
  const res = await getS3Client(settings).send(new HeadBucketCommand({ Bucket: settings.bucket }), {
    abortSignal: AbortSignal.timeout(5_000),
  })
  return res.$metadata.httpStatusCode === 200
}
