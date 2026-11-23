import type { CollectionBeforeChangeHook } from 'payload'

import { readingStats } from '../lib/lexical'

/** Calcula wordCount e readingTime (220 palavras/min) a partir do Lexical. */
export const computeReadingStats: CollectionBeforeChangeHook = ({ data }) => {
  if (data && 'content' in data) {
    const { wordCount, readingTime } = readingStats(data.content)
    data.wordCount = wordCount
    data.readingTime = readingTime
  }
  return data
}

/** Preenche publishedAt na primeira publicação, se ninguém definiu a data. */
export const setPublishedAt: CollectionBeforeChangeHook = ({ data }) => {
  if (data && data._status === 'published' && !data.publishedAt) {
    data.publishedAt = new Date().toISOString()
  }
  return data
}
