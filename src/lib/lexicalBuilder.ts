/** Monta um estado Lexical simples (parágrafos e títulos) — usado no seed e nos testes. */
type Block = string | { heading: string; tag?: 'h2' | 'h3' }

const textNode = (text: string) => ({
  type: 'text',
  text,
  detail: 0,
  format: 0,
  mode: 'normal',
  style: '',
  version: 1,
})

export function lexicalFromBlocks(blocks: Block[]) {
  return {
    root: {
      type: 'root',
      direction: 'ltr' as const,
      format: '' as const,
      indent: 0,
      version: 1,
      children: blocks.map((b) =>
        typeof b === 'string'
          ? {
              type: 'paragraph',
              direction: 'ltr',
              format: '',
              indent: 0,
              textFormat: 0,
              version: 1,
              children: [textNode(b)],
            }
          : {
              type: 'heading',
              tag: b.tag ?? 'h2',
              direction: 'ltr',
              format: '',
              indent: 0,
              version: 1,
              children: [textNode(b.heading)],
            },
      ),
    },
  }
}
