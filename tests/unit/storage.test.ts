import { describe, expect, it } from 'vitest'

import { IMAGE_SIZES, Media } from '@/collections/Media'
import { bucketExists, buildPublicFileURL, getStorageSettings } from '@/lib/storage'

describe('getStorageSettings', () => {
  it('lê o ambiente e liga o storage só com bucket e chaves', () => {
    const s = getStorageSettings({
      S3_BUCKET: 'pronto-falei-media',
      S3_ACCESS_KEY_ID: 'app',
      S3_SECRET_ACCESS_KEY: 'segredo',
      S3_ENDPOINT: 'http://minio:9000',
      MEDIA_PUBLIC_URL: 'https://img.exemplo.dev/',
    } as never)
    expect(s).toMatchObject({
      enabled: true,
      bucket: 'pronto-falei-media',
      endpoint: 'http://minio:9000',
      region: 'us-east-1',
      forcePathStyle: true,
      publicUrl: 'https://img.exemplo.dev',
    })
  })

  it('sem chaves o storage fica desligado e o bucket conta como ausente', async () => {
    const s = getStorageSettings({ S3_BUCKET: 'x' } as never)
    expect(s.enabled).toBe(false)
    expect(s.publicUrl).toBeUndefined()
    await expect(bucketExists(s)).resolves.toBe(false)
  })

  it('S3_FORCE_PATH_STYLE=false desliga path-style', () => {
    expect(getStorageSettings({ S3_FORCE_PATH_STYLE: 'false' } as never).forcePathStyle).toBe(false)
  })
})

describe('buildPublicFileURL', () => {
  it('junta base, pasta e nome', () => {
    expect(buildPublicFileURL('https://img.exemplo.dev', 'media/abc', 'foto-400x225.webp')).toBe(
      'https://img.exemplo.dev/media/abc/foto-400x225.webp',
    )
  })
  it('lida com barras e prefixo vazio', () => {
    expect(buildPublicFileURL('http://localhost:3131/pronto-falei-media/', '', 'a.png')).toBe(
      'http://localhost:3131/pronto-falei-media/a.png',
    )
    expect(buildPublicFileURL('https://img.x', '/media//', 'a.png')).toBe(
      'https://img.x/media/a.png',
    )
  })
  it('codifica espaços e acentos', () => {
    expect(buildPublicFileURL('https://img.x', 'media', 'café da manhã.png')).toBe(
      'https://img.x/media/caf%C3%A9%20da%20manh%C3%A3.png',
    )
  })
})

describe('tamanhos de imagem', () => {
  it('segue o plano: thumb 400, card 800, hero 1600, og 1200×630, todos em WebP', () => {
    expect(IMAGE_SIZES.map((s) => s.name)).toEqual(['thumb', 'card', 'hero', 'og'])
    const sizes = (Media.upload as { imageSizes: Record<string, unknown>[] }).imageSizes
    expect(sizes).toEqual([
      expect.objectContaining({ name: 'thumb', width: 400, withoutEnlargement: true }),
      expect.objectContaining({ name: 'card', width: 800, withoutEnlargement: true }),
      expect.objectContaining({ name: 'hero', width: 1600, withoutEnlargement: true }),
      expect.objectContaining({ name: 'og', width: 1200, height: 630, withoutEnlargement: false }),
    ])
    for (const s of sizes) expect(s.formatOptions).toMatchObject({ format: 'webp' })
    expect(Media.upload).toMatchObject({ adminThumbnail: 'thumb', focalPoint: true })
  })
})
