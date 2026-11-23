/**
 * Realce de código com Shiki no servidor (zero JS no navegador), nos temas
 * github-light e github-dark. As cores saem como variáveis CSS e o tema do
 * site escolhe qual usar.
 */
import { createHighlighterCore, type HighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'

import { CODE_LANGUAGES } from '../blocks'

let highlighter: Promise<HighlighterCore> | null = null

function getHighlighter() {
  highlighter ??= createHighlighterCore({
    themes: [import('shiki/themes/github-light.mjs'), import('shiki/themes/github-dark.mjs')],
    langs: [
      import('shiki/langs/bash.mjs'),
      import('shiki/langs/typescript.mjs'),
      import('shiki/langs/javascript.mjs'),
      import('shiki/langs/tsx.mjs'),
      import('shiki/langs/json.mjs'),
      import('shiki/langs/python.mjs'),
      import('shiki/langs/go.mjs'),
      import('shiki/langs/php.mjs'),
      import('shiki/langs/sql.mjs'),
      import('shiki/langs/yaml.mjs'),
      import('shiki/langs/dockerfile.mjs'),
      import('shiki/langs/html.mjs'),
      import('shiki/langs/css.mjs'),
      import('shiki/langs/markdown.mjs'),
    ],
    engine: createJavaScriptRegexEngine(),
  })
  return highlighter
}

export function shikiLang(language: string | null | undefined): string {
  return language && (CODE_LANGUAGES as readonly string[]).includes(language) && language !== 'text'
    ? language
    : 'text'
}

export async function highlight(code: string, language?: string | null): Promise<string> {
  const hl = await getHighlighter()
  return hl.codeToHtml(code, {
    lang: shikiLang(language),
    themes: { light: 'github-light', dark: 'github-dark' },
    defaultColor: false,
  })
}
