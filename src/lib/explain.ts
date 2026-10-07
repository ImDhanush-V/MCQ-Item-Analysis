import type { ItemStat } from './stats.ts'
import { fmt, signed } from './format.ts'

/** One plain sentence saying why a question got its recommendation. */
export function explainItem(i: ItemStat, optionText?: string[]): string {
  const parts: string[] = []
  if (i.difRating.level !== 'good') parts.push(`${i.difRating.label.toLowerCase()} (${fmt(i.difR, 1)}% got it right)`)
  if (i.diRating.level !== 'good') parts.push(`discrimination ${i.diRating.label.toLowerCase()} (${signed(i.diR)})`)
  if (i.nfd.length) parts.push(`${i.nfd.length} unused wrong option${i.nfd.length === 1 ? '' : 's'}: ${i.nfd.map((l) => (optionText?.[l.charCodeAt(0) - 65] ? `${l} (${optionText[l.charCodeAt(0) - 65]})` : l)).join(', ')}`)
  const s = parts.join('; ')
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Difficulty, discrimination and distractors are all in the acceptable range.'
}
