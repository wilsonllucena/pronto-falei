import {
  type JSXConvertersFunction,
  LinkJSXConverter,
  RichText,
} from '@payloadcms/richtext-lexical/react'
import React from 'react'

import { postHref } from '@/lib/site'

import { Callout, EmbedBlock, Figure, Quote } from './Blocks'
import { CodeBlock } from './CodeBlock'

type Data = Parameters<typeof RichText>[0]['data']
type BlockArgs = { node: { fields: Record<string, unknown> } }

const internalDocToHref = ({ linkNode }: { linkNode: { fields: { doc?: unknown } } }) => {
  const doc = linkNode.fields.doc as
    { relationTo?: string; value?: { slug?: string } | string } | undefined
  const value = doc?.value
  const slug = typeof value === 'object' ? value?.slug : undefined
  if (!slug) return '#'
  return doc?.relationTo === 'posts' ? postHref(slug) : `/${slug}`
}

const converters: JSXConvertersFunction = ({ defaultConverters }) => ({
  ...defaultConverters,
  ...LinkJSXConverter({ internalDocToHref: internalDocToHref as never }),
  heading: ({ node, nodesToJSX }) => {
    const Tag = (['h2', 'h3', 'h4'].includes(node.tag) ? node.tag : 'h2') as 'h2' | 'h3' | 'h4'
    const id = (node as { anchorId?: string }).anchorId
    const children = nodesToJSX({ nodes: node.children })
    return (
      <Tag id={id} className="prose__heading">
        {children}
        {id && (
          <a href={`#${id}`} className="anchor" aria-label="Link para esta seção">
            #
          </a>
        )}
      </Tag>
    )
  },
  upload: ({ node }) => {
    const n = node as { value?: unknown; fields?: { caption?: string } }
    return <Figure media={n.value as never} caption={n.fields?.caption} />
  },
  blocks: {
    code: ({ node }: BlockArgs) => (
      <CodeBlock
        code={String(node.fields.code ?? '')}
        language={node.fields.language as string}
        title={node.fields.title as string}
      />
    ),
    callout: ({ node }: BlockArgs) => (
      <Callout
        tone={node.fields.tone as string}
        title={node.fields.title as string}
        content={String(node.fields.content ?? '')}
      />
    ),
    embed: ({ node }: BlockArgs) => (
      <EmbedBlock url={String(node.fields.url ?? '')} caption={node.fields.caption as string} />
    ),
    quote: ({ node }: BlockArgs) => (
      <Quote
        text={String(node.fields.text ?? '')}
        author={node.fields.author as string}
        sourceUrl={node.fields.sourceUrl as string}
      />
    ),
  },
})

/** Corpo do post: Lexical → JSX com os blocos do blog. */
export function PostBody({ content }: { content: unknown }) {
  if (!content) return null
  return <RichText data={content as Data} converters={converters} className="prose" />
}
