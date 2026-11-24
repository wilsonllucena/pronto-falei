/** Regras da síntese (TL;DR) do post, conforme o plano. */
export const SUMMARY_MIN = 160
export const SUMMARY_MAX = 400
export const KEY_POINTS_MIN = 3
export const KEY_POINTS_MAX = 5
export const KEY_POINT_MAX = 140

export const SUMMARY_SOURCES = [
  { label: 'Manual', value: 'manual' },
  { label: 'IA', value: 'ia' },
  { label: 'IA editada', value: 'ia-editada' },
  { label: 'Extrativo (automático)', value: 'extrativo' },
] as const

export type SummarySource = (typeof SUMMARY_SOURCES)[number]['value']

/**
 * Se a origem da síntese for IA (pura, editada ou o resumo extrativo), o post só publica com a
 * revisão marcada. Validações só rodam ao publicar (rascunhos não validam).
 */
export function validateSummaryReviewed(reviewed: unknown, source: unknown): true | string {
  if (source && source !== 'manual' && reviewed !== true) {
    return 'A síntese veio da IA: revise e marque "Síntese revisada" antes de publicar.'
  }
  return true
}
