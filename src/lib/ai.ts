// Client side of the optional AI helper. The AI never calculates: it only words results that were already calculated here,
// and every number or question label in its answer is checked against those results before anything is shown.
import type { Analysis, ItemStat } from './stats.ts'
import { fmt, roundHalfUp } from './format.ts'

export class AiError extends Error {}

export interface AiState { status: 'unknown' | 'ready' | 'off' }

export async function aiAvailable(endpoint: string): Promise<boolean> {
  try {
    const r = await fetch(endpoint, { method: 'GET', signal: AbortSignal.timeout(6000) })
    if (!r.ok) return false
    const j = await r.json()
    return !!j?.configured
  } catch { return false }
}

export async function callAi(endpoint: string, task: 'summary' | 'review' | 'mapping', payload: unknown): Promise<string> {
  let r: Response
  try {
    r = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ task, payload }), signal: AbortSignal.timeout(40000) })
  } catch { throw new AiError('The AI helper could not be reached. Check your connection and try again.') }
  let j: any = null
  try { j = await r.json() } catch { /* handled below */ }
  if (!r.ok || !j?.text) throw new AiError(j?.error ?? 'The AI helper did not answer. Please try again.')
  return String(j.text)
}

const itemPayload = (i: ItemStat, a: Analysis) => ({
  label: i.label, key: i.key, hlPercent: roundHalfUp(i.hlPercent, 1), dif: i.difR, di: i.diR, nfd: i.nfd.length, de: i.deR,
  difRating: i.difRating.label, diRating: i.diRating.label, action: i.action.text, highCorrect: i.highCorrect, lowCorrect: i.lowCorrect, g: a.g,
  optionPct: Object.fromEntries(Object.entries(i.optionPct).map(([k, v]) => [k, roundHalfUp(v, 1)])),
})
export const summaryPayload = (a: Analysis) => ({ n: a.n, k: a.k, g: a.g, nMedium: a.nMedium, mean: roundHalfUp(a.mean, 2), alpha: a.alphaR, alphaRating: a.alphaRating.label, items: a.items.map((i) => itemPayload(i, a)) })
export const reviewPayload = (a: Analysis, i: ItemStat, text: string) => ({ item: itemPayload(i, a), text })

// ---------------------------------------------------------------- the number checker
const RULE_NUMBERS = [0, 5, 30, 70, 100, 0.2, 0.3, 0.4, 0.7, 0.8]

/** Every number the AI is allowed to quote, as plain numbers. */
export function allowedNumbers(a: Analysis, only?: ItemStat): Set<number> {
  const s = new Set<number>(RULE_NUMBERS)
  const add = (x: number | null | undefined) => { if (x !== null && x !== undefined && Number.isFinite(x)) { s.add(roundHalfUp(x, 0)); s.add(roundHalfUp(x, 1)); s.add(roundHalfUp(x, 2)); s.add(Math.abs(roundHalfUp(x, 2))) } }
  const level = { good: 0, warn: 0, bad: 0 }
  a.items.forEach((i) => level[i.action.level]++)
  ;[a.n, a.k, a.g, a.nMedium, a.mean, a.sd, a.alpha, a.min, a.max, a.median, level.good, level.warn, level.bad].forEach(add)
  for (const i of only ? [only] : a.items) {
    ;[i.hlPercent, i.dif, i.di, i.de, i.nfd.length, i.correct, i.highCorrect, i.lowCorrect, i.hlDenominator, a.nOptions - 1, ...Object.values(i.optionPct)].forEach(add)
  }
  return s
}

/** Returns the problems found in the AI text. An empty list means every number and question label matches the results. */
export function verifyText(text: string, a: Analysis, only?: ItemStat): string[] {
  const problems: string[] = []
  const labels = new Set(a.items.map((i) => i.label.toLowerCase()))
  const rest = text.replace(/\b(Q|Question|Item)\s?(\d+)\b/gi, (m) => {
    if (!labels.has(m.replace(/\s/g, '').toLowerCase()) && !labels.has(m.toLowerCase())) problems.push(`label ${m}`)
    return ' '
  })
  const allowed = allowedNumbers(a, only)
  for (const m of rest.matchAll(/(?<![\w.])-?\d+(?:\.\d+)?/g)) {
    const v = Number(m[0])
    if (![v, Math.abs(v)].some((x) => allowed.has(x) || [...allowed].some((y) => Math.abs(y - x) < 1e-9))) problems.push(`number ${m[0]}`)
  }
  return problems
}

/** A plain-language summary written by rules (no AI). Shown when the AI is off or its answer failed the number check. */
export function plainSummary(a: Analysis): string {
  const good = a.items.filter((i) => i.action.level === 'good')
  const bad = a.items.filter((i) => i.action.level === 'bad')
  const rel = a.alpha === null ? 'Reliability could not be worked out because every student scored the same.' : `Reliability (Cronbach's alpha) is ${fmt(a.alpha, 2)}, which is rated "${a.alphaRating.label.toLowerCase()}".`
  const hard = a.items.filter((i) => i.difRating.label === 'Too difficult').map((i) => i.label)
  const easy = a.items.filter((i) => i.difRating.label === 'Too easy').map((i) => i.label)
  const p1 = `${a.n} students answered ${a.k} questions; the average score was ${fmt(a.mean, 1)}. ${rel}`
  const p2 = `${good.length} question${good.length === 1 ? ' is' : 's are'} fine to keep as they are. ${bad.length ? `These need revision: ${bad.map((i) => `${i.label} (${i.action.text.toLowerCase()})`).join('; ')}.` : 'No question is flagged for revision.'}${easy.length ? ` Too easy: ${easy.join(', ')}.` : ''}${hard.length ? ` Too difficult: ${hard.join(', ')}.` : ''}`
  return `${p1}\n\n${p2}`
}
