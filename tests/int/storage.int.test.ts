import {
  CreateBucketCommand,
  HeadObjectCommand,
  ListBucketsCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getPayload, type Payload } from 'payload'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { bucketExists, getStorageSettings } from '@/lib/storage'

let payload: Payload
const settings = getStorageSettings()
const s3 = new S3Client({
  endpoint: settings.endpoint,
  region: settings.region,
  forcePathStyle: settings.forcePathStyle,
  credentials: { accessKeyId: settings.accessKeyId, secretAccessKey: settings.secretAccessKey },
})
const run = Date.now().toString(36)
let mediaId: string | number | undefined

type MediaDoc = {
  id: string | number
  url?: string | null
  filename?: string | null
  prefix?: string | null
  width?: number | null
  height?: number | null
  sizes?: Record<
    string,
    {
      url?: string | null
      filename?: string | null
      width?: number | null
      height?: number | null
      mimeType?: string | null
    }
  >
}

/** Chave do objeto no bucket, a partir da URL pública. */
const keyFromUrl = (url: string) =>
  decodeURIComponent(new URL(url).pathname.replace(`/${settings.bucket}/`, ''))

describe('MinIO: storage das imagens (passo 3)', () => {
  beforeAll(async () => {
    expect(settings.enabled, 'defina S3_* no .env e rode o minio-init').toBe(true)
    payload = await getPayload({ config: await config })
  })

  afterAll(async () => {
    if (mediaId) await payload.delete({ collection: 'media', id: mediaId }).catch(() => undefined)
    await payload.destroy()
  })

  it('o bucket existe e o app acessa com o usuário restrito', async () => {
    await expect(bucketExists(settings)).resolves.toBe(true)
  })

  it('o usuário do app só enxerga o próprio bucket e não cria outros', async () => {
    const list = await s3.send(new ListBucketsCommand({}))
    expect(list.Buckets?.map((b) => b.Name)).toEqual([settings.bucket])
    await expect(s3.send(new CreateBucketCommand({ Bucket: `outro-${run}` }))).rejects.toThrow()
  })

  it('upload gera original + thumb/card/hero/og em WebP no bucket, com URL pública', async () => {
    const png = await sharp({
      create: { width: 2000, height: 1200, channels: 3, background: { r: 217, g: 72, b: 15 } },
    })
      .png()
      .toBuffer()

    const doc = (await payload.create({
      collection: 'media',
      data: { alt: `Imagem de teste ${run}` },
      file: { data: png, mimetype: 'image/png', name: `teste-${run}.png`, size: png.length },
    })) as unknown as MediaDoc
    mediaId = doc.id

    expect(doc.width).toBe(2000)
    expect(doc.url).toMatch(new RegExp(`^${settings.publicUrl}/media/`))

    const expected = { thumb: [400, 240], card: [800, 480], hero: [1600, 960], og: [1200, 630] }
    for (const [name, [w, h]] of Object.entries(expected)) {
      const size = doc.sizes?.[name]
      expect(size, name).toBeDefined()
      expect(size?.width, name).toBe(w)
      expect(size?.height, name).toBe(h)
      expect(size?.mimeType, name).toBe('image/webp')
      expect(size?.url, name).toMatch(/\.webp$/)
      const head = await s3.send(
        new HeadObjectCommand({ Bucket: settings.bucket, Key: keyFromUrl(size!.url!) }),
      )
      expect(head.ContentType, name).toBe('image/webp')
    }
    await s3.send(new HeadObjectCommand({ Bucket: settings.bucket, Key: keyFromUrl(doc.url!) }))
  })

  it('a URL pública abre sem login (leitura anônima só em media/)', async () => {
    const doc = (await payload.findByID({
      collection: 'media',
      id: mediaId!,
    })) as unknown as MediaDoc
    const res = await fetch(doc.sizes!.card!.url!)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/webp')

    // fora de media/ continua privado
    await s3.send(
      new PutObjectCommand({ Bucket: settings.bucket, Key: `privado/${run}.txt`, Body: 'x' }),
    )
    const priv = await fetch(`${settings.publicUrl}/privado/${run}.txt`)
    expect(priv.status).toBe(403)
  })

  it('apagar a mídia remove os arquivos do bucket', async () => {
    const doc = (await payload.findByID({
      collection: 'media',
      id: mediaId!,
    })) as unknown as MediaDoc
    const keys = [doc.url!, ...Object.values(doc.sizes ?? {}).map((s) => s.url!)].map(keyFromUrl)
    await payload.delete({ collection: 'media', id: mediaId! })
    mediaId = undefined
    for (const key of keys) {
      await expect(
        s3.send(new HeadObjectCommand({ Bucket: settings.bucket, Key: key })),
      ).rejects.toThrow()
    }
  })
})
