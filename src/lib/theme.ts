import type { ThemeName } from '../design/tokens'

export const THEME_COOKIE = 'pf-theme'
export const THEME_MAX_AGE = 60 * 60 * 24 * 365

export function parseTheme(value: unknown): ThemeName | null {
  return value === 'light' || value === 'dark' ? value : null
}

/**
 * Script inline no <head>: aplica o tema salvo no cookie antes da primeira
 * pintura (sem piscar). Sem cookie, vale o tema do sistema via CSS.
 * Fica fora do React pra funcionar com página em cache (ISR).
 */
export const themeInitScript = `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(light|dark)/);if(m)document.documentElement.setAttribute('data-theme',m[1]);}catch(e){}})();`

export function themeCookie(theme: ThemeName): string {
  return `${THEME_COOKIE}=${theme}; Path=/; Max-Age=${THEME_MAX_AGE}; SameSite=Lax`
}
