/** Datas do site sempre no fuso do Wilson, em pt-BR. */
export const SITE_TIMEZONE = 'America/Sao_Paulo'

const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

const partsFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: SITE_TIMEZONE,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
})

export function dateParts(value: string | Date): { year: number; month: number; day: number } {
  const parts = partsFmt.formatToParts(new Date(value))
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  return { year: get('year'), month: get('month'), day: get('day') }
}

/** "20 nov" */
export function formatShortDate(value: string | Date): string {
  const { month, day } = dateParts(value)
  return `${String(day).padStart(2, '0')} ${MONTHS[month - 1].slice(0, 3)}`
}

/** "20 nov 2026" */
export function formatDate(value: string | Date): string {
  return `${formatShortDate(value)} ${dateParts(value).year}`
}

/** "novembro de 2026" */
export function monthLabel(year: number, month: number): string {
  return `${MONTHS[month - 1]} de ${year}`
}

export type MonthGroup<T> = { key: string; label: string; items: T[] }

/** Agrupa por mês (fuso do site), mantendo a ordem de entrada. */
export function groupByMonth<T>(items: T[], getDate: (item: T) => string | Date): MonthGroup<T>[] {
  const groups: MonthGroup<T>[] = []
  for (const item of items) {
    const { year, month } = dateParts(getDate(item))
    const key = `${year}-${String(month).padStart(2, '0')}`
    let group = groups.find((g) => g.key === key)
    if (!group) {
      group = { key, label: monthLabel(year, month), items: [] }
      groups.push(group)
    }
    group.items.push(item)
  }
  return groups
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}
