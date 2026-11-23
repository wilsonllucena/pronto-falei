import type { CollectionConfig, Field } from 'payload'
import { describe, expect, it } from 'vitest'

import { Categories } from '@/collections/Categories'
import { Media } from '@/collections/Media'
import { Pages } from '@/collections/Pages'
import { Posts } from '@/collections/Posts'
import { Tags } from '@/collections/Tags'
import { Users } from '@/collections/Users'
import { healthEndpoint } from '@/endpoints/health'
import { Navigation } from '@/globals/Navigation'
import { SiteSettings } from '@/globals/SiteSettings'

/** Achata tabs/rows/collapsibles pra achar campos por nome. */
function flatFields(fields: Field[]): Field[] {
  return fields.flatMap((f) => {
    if (f.type === 'tabs')
      return f.tabs.flatMap((t) => ('name' in t && t.name ? [] : flatFields(t.fields)))
    if (f.type === 'row' || f.type === 'collapsible') return flatFields(f.fields)
    return [f]
  })
}
const field = (c: CollectionConfig, name: string) =>
  flatFields(c.fields).find((f) => 'name' in f && f.name === name) as
    Record<string, unknown> | undefined

describe('collections do passo 2', () => {
  it('Posts tem os campos do plano', () => {
    for (const name of [
      'title',
      'slug',
      'subtitle',
      'summary',
      'keyPoints',
      'summarySource',
      'summaryReviewed',
      'summaryModel',
      'summaryGeneratedAt',
      'content',
      'cover',
      'tags',
      'category',
      'featured',
      'publishedAt',
      'readingTime',
      'wordCount',
      'relatedPosts',
    ]) {
      expect(field(Posts, name), name).toBeDefined()
    }
    expect(field(Posts, 'summary')).toMatchObject({
      required: true,
      minLength: 160,
      maxLength: 400,
    })
    expect(field(Posts, 'keyPoints')).toMatchObject({ minRows: 3, maxRows: 5, required: true })
    expect(field(Posts, 'slug')).toMatchObject({ unique: true, required: true })
  })

  it('Posts e Pages têm rascunho, autosave e versões', () => {
    expect(Posts.versions).toMatchObject({
      drafts: { autosave: expect.anything(), schedulePublish: true },
    })
    expect(Pages.versions).toMatchObject({ drafts: { autosave: expect.anything() } })
  })

  it('Tags, Categories e Pages têm slug único', () => {
    for (const c of [Tags, Categories, Pages]) {
      expect(field(c, 'slug'), c.slug).toMatchObject({ unique: true })
    }
    expect(field(Categories, 'color')).toBeDefined()
  })

  it('Media exige alt e tem legenda, crédito e focal point', () => {
    expect(field(Media, 'alt')).toMatchObject({ required: true })
    expect(field(Media, 'caption')).toBeDefined()
    expect(field(Media, 'credit')).toBeDefined()
    expect(Media.upload).toMatchObject({ mimeTypes: ['image/*'], focalPoint: true })
  })

  it('Users: auth, campos de autor e sem cadastro público', async () => {
    expect(Users.auth).toBe(true)
    for (const name of ['name', 'avatar', 'bio']) expect(field(Users, name)).toBeDefined()
    const create = Users.access?.create as (a: unknown) => unknown
    expect(await create({ req: { user: null } })).toBe(false)
  })

  it('visitante só lê posts e páginas publicados', async () => {
    for (const c of [Posts, Pages]) {
      const read = c.access?.read as (a: unknown) => unknown
      expect(await read({ req: { user: null } })).toEqual({ _status: { equals: 'published' } })
      expect(await read({ req: { user: { id: '1' } } })).toBe(true)
    }
  })

  it('globals SiteSettings e Navigation', () => {
    expect(SiteSettings.slug).toBe('site-settings')
    expect(Navigation.slug).toBe('navigation')
  })

  it('health responde em GET /health', () => {
    expect(healthEndpoint).toMatchObject({ path: '/health', method: 'get' })
  })
})
