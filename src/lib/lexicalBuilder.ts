/** Monta estados Lexical (parágrafos, títulos, listas, blocos) — usado no seed e nos testes. */
export type Inline =
  string | { text: string; bold?: boolean; italic?: boolean; code?: boolean; href?: string }

export type Block =
  | string
  | { heading: string; tag?: 'h2' | 'h3' }
  | { paragraph: Inline[] }
  | { list: Inline[][]; ordered?: boolean }
  | { code: string; language: string; title?: string }
  | { callout: string; tone?: 'info' | 'dica' | 'atencao' | 'perigo'; title?: string }
  | { quote: string; author?: string; sourceUrl?: string }
  | { embed: string; caption?: string }
  | { image: string; caption?: string }

const FORMAT = { bold: 1, italic: 2, code: 16 }

const textNode = (text: string, format = 0) => ({
  type: 'text',
  text,
  detail: 0,
  format,
  mode: 'normal',
  style: '',
  version: 1,
})

const base = { direction: 'ltr' as const, format: '' as const, indent: 0, version: 1 }

function inlineNode(i: Inline) {
  if (typeof i === 'string') return textNode(i)
  const format =
    (i.bold ? FORMAT.bold : 0) | (i.italic ? FORMAT.italic : 0) | (i.code ? FORMAT.code : 0)
  const t = textNode(i.text, format)
  if (!i.href) return t
  return {
    ...base,
    type: 'link',
    version: 3,
    fields: { url: i.href, newTab: false, linkType: 'custom' },
    id: blockId(),
    children: [t],
  }
}

let counter = 0
/** Id hexadecimal de 24 caracteres (formato que o Payload usa nos blocos). */
function blockId(): string {
  counter += 1
  return (Date.now().toString(16) + counter.toString(16).padStart(6, '0'))
    .padEnd(24, '0')
    .slice(0, 24)
}

function blockNode(blockType: string, fields: Record<string, unknown>) {
  return {
    type: 'block',
    version: 2,
    format: '',
    fields: { id: blockId(), blockName: '', blockType, ...fields },
  }
}

function toNode(b: Block) {
  if (typeof b === 'string') {
    return { ...base, type: 'paragraph', textFormat: 0, children: [textNode(b)] }
  }
  if ('heading' in b) {
    return { ...base, type: 'heading', tag: b.tag ?? 'h2', children: [textNode(b.heading)] }
  }
  if ('paragraph' in b) {
    return { ...base, type: 'paragraph', textFormat: 0, children: b.paragraph.map(inlineNode) }
  }
  if ('list' in b) {
    return {
      ...base,
      type: 'list',
      listType: b.ordered ? 'number' : 'bullet',
      tag: b.ordered ? 'ol' : 'ul',
      start: 1,
      children: b.list.map((item, i) => ({
        ...base,
        type: 'listitem',
        value: i + 1,
        children: item.map(inlineNode),
      })),
    }
  }
  if ('code' in b) return blockNode('code', { code: b.code, language: b.language, title: b.title })
  if ('callout' in b) {
    return blockNode('callout', { content: b.callout, tone: b.tone ?? 'info', title: b.title })
  }
  if ('quote' in b) {
    return blockNode('quote', { text: b.quote, author: b.author, sourceUrl: b.sourceUrl })
  }
  if ('embed' in b) return blockNode('embed', { url: b.embed, caption: b.caption })
  return {
    type: 'upload',
    version: 3,
    format: '',
    id: blockId(),
    relationTo: 'media',
    value: b.image,
    fields: b.caption ? { caption: b.caption } : {},
  }
}

export function lexicalFromBlocks(blocks: Block[]) {
  return {
    root: {
      type: 'root',
      direction: 'ltr' as const,
      format: '' as const,
      indent: 0,
      version: 1,
      children: blocks.map(toNode),
    },
  }
}
