// All statistics. Pure functions; every number the site shows comes from here.
import type { Dataset, Level, Rating } from './types.ts'
import { LETTERS } from './text.ts'
import { roundHalfUp } from './format.ts'

export const NFD_CUTOFF_PCT = 5

export interface ItemStat {
  index: number
  label: string
  heading: string
  key: string
  correct: number
  p: number
  variance: number
  dif: number
  difR: number
  highCorrect: number
  lowCorrect: number
  hlDenominator: number
  hlPercent: number
  hlPercentR: number
  di: number
  diR: number
  optionCounts: Record<string, number>
  optionPct: Record<string, number>
  blank: number
  invalid: number
  nOpt: number
  nWrong: number
  nfd: string[]
  de: number
  deR: number
  difRating: Rating
  diRating: Rating
  deRating: Rating
  action: { text: string; level: Level; rule: string }
}
export interface StudentStat { index: number; id: string; row: number; total: number; percent: number; rank: number; group: 'High' | 'Medium' | 'Low' }
export interface Analysis {
  n: number
  k: number
  nOptions: number
  scores: number[][]
  totals: number[]
  mean: number
  variance: number
  sd: number
  median: number
  min: number
  max: number
  order: number[]
  g: number
  nMedium: number
  high: number[]
  medium: number[]
  low: number[]
  cutoff: { highScore: number; highTied: number; highTakenFromTied: number; lowScore: number; lowTied: number; lowTakenFromTied: number }
  items: ItemStat[]
  students: StudentStat[]
  sumItemVar: number
  alpha: number | null
  alphaR: number | null
  alphaRating: Rating
  histogram: number[]
  warnings: string[]
  dataset: Dataset
}

export function sampleVariance(xs: number[]): number {
  const n = xs.length
  const m = xs.reduce((a, b) => a + b, 0) / n
  return xs.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1)
}

/** High and Low groups each get floor(n/3) students; whatever is left over (0, 1 or 2 students) goes to Medium. */
export function groupSize(n: number): number {
  return Math.floor(n / 3)
}

export const rateDif = (x: number): Rating => (x > 70 ? { label: 'Too easy', level: 'bad' } : x < 30 ? { label: 'Too difficult', level: 'bad' } : { label: 'Acceptable', level: 'good' })
export const rateDi = (x: number): Rating =>
  x < 0 ? { label: 'Defective', level: 'bad' } : x < 0.2 ? { label: 'Poor', level: 'bad' } : x < 0.3 ? { label: 'Acceptable', level: 'warn' } : x < 0.4 ? { label: 'Good', level: 'warn' } : { label: 'Excellent', level: 'good' }
export const rateDe = (nfd: number, nWrong: number): Rating =>
  nfd === 0 ? { label: 'Excellent', level: 'good' } : nfd >= nWrong ? { label: 'Poor', level: 'bad' } : nfd === 1 ? { label: 'Good', level: 'warn' } : { label: 'Needs revision', level: 'warn' }
export const rateAlpha = (a: number | null): Rating =>
  a === null ? { label: 'Not defined', level: 'bad' } : a >= 0.8 ? { label: 'High reliability', level: 'good' } : a >= 0.7 ? { label: 'Acceptable for classroom use', level: 'warn' } : { label: 'Low reliability', level: 'bad' }

export function decideAction(diR: number, nfd: number, levels: Level[]): { text: string; level: Level; rule: string } {
  const bad = levels.filter((l) => l === 'bad').length
  if (diR < 0) return { text: 'Check the answer key or a confusing stem', level: 'bad', rule: 'Rule 1: the discrimination index is negative' }
  if (bad >= 2) return { text: 'Flawed item: revise the stem and options', level: 'bad', rule: 'Rule 2: two or more ratings are red' }
  if (bad === 1) return { text: 'Revise (see the red rating)', level: 'bad', rule: 'Rule 3: one rating is red' }
  if (nfd > 0) return { text: 'Retain; tweak the weak distractor(s)', level: 'warn', rule: 'Rule 4: at least one distractor is non-functional' }
  if (levels.includes('warn')) return { text: 'Retain; minor review', level: 'warn', rule: 'Rule 5: a rating is amber' }
  return { text: 'Retain in the question bank', level: 'good', rule: 'Rule 6: all ratings are green' }
}

export function analyse(ds: Dataset): Analysis {
  const n = ds.ids.length
  const k = ds.questions.length
  const scores: number[][] = ds.answers.map((row) => row.map((a, j) => (a === ds.key[j] ? 1 : 0)))
  const totals = scores.map((r) => r.reduce((a, b) => a + b, 0))
  const mean = totals.reduce((a, b) => a + b, 0) / n
  const variance = sampleVariance(totals)
  const sorted = [...totals].sort((a, b) => a - b)
  const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2
  const order = totals.map((_, i) => i).sort((a, b) => totals[b] - totals[a] || a - b) // highest first, ties keep file order
  const g = groupSize(n)
  const high = order.slice(0, g)
  const low = order.slice(n - g)
  const medium = order.slice(g, n - g)
  const highScore = totals[order[g - 1]]
  const lowScore = totals[order[n - g]]
  const cutoff = {
    highScore,
    highTied: totals.filter((t) => t === highScore).length,
    highTakenFromTied: high.filter((i) => totals[i] === highScore).length,
    lowScore,
    lowTied: totals.filter((t) => t === lowScore).length,
    lowTakenFromTied: low.filter((i) => totals[i] === lowScore).length,
  }
  const items: ItemStat[] = ds.questions.map((q, j) => {
    const col = scores.map((r) => r[j])
    const nOpt = ds.optionCount?.[j] ?? ds.nOptions
    const letters = LETTERS.slice(0, nOpt).split('')
    const nWrong = nOpt - 1
    const correct = col.reduce((a, b) => a + b, 0)
    const dif = (correct / n) * 100
    const highCorrect = high.reduce((a, i) => a + col[i], 0)
    const lowCorrect = low.reduce((a, i) => a + col[i], 0)
    const di = highCorrect / g - lowCorrect / g
    const hlDenominator = 2 * g
    const hlPercent = (highCorrect + lowCorrect) / hlDenominator * 100
    const optionCounts: Record<string, number> = {}
    const optionPct: Record<string, number> = {}
    for (const L of letters) {
      optionCounts[L] = ds.answers.filter((r) => r[j] === L).length
      optionPct[L] = (optionCounts[L] / n) * 100
    }
    const nfd = letters.filter((L) => L !== ds.key[j] && optionPct[L] < NFD_CUTOFF_PCT)
    const de = ((nWrong - nfd.length) / nWrong) * 100
    const difR = roundHalfUp(dif, 1)
    const diR = roundHalfUp(di, 2)
    const difRating = rateDif(difR)
    const diRating = rateDi(diR)
    const deRating = rateDe(nfd.length, nWrong)
    return {
      index: j, label: q.label, heading: q.heading, key: ds.key[j], correct, p: correct / n, variance: sampleVariance(col),
      dif, difR, highCorrect, lowCorrect, hlDenominator, hlPercent, hlPercentR: roundHalfUp(hlPercent, 1), di, diR, optionCounts, optionPct,
      blank: ds.answers.filter((r) => r[j] === '').length, invalid: ds.answers.filter((r) => r[j] === '?').length,
      nOpt, nWrong, nfd, de, deR: roundHalfUp(de, 1), difRating, diRating, deRating,
      action: decideAction(diR, nfd.length, [difRating.level, diRating.level, deRating.level]),
    }
  })
  const sumItemVar = items.reduce((a, b) => a + b.variance, 0)
  const alpha = variance > 0 ? (k / (k - 1)) * (1 - sumItemVar / variance) : null
  const alphaR = alpha === null ? null : roundHalfUp(alpha, 2)
  const highSet = new Set(high)
  const lowSet = new Set(low)
  const students: StudentStat[] = ds.ids.map((id, i) => ({
    index: i, id, row: ds.studentRows[i], total: totals[i], percent: (totals[i] / k) * 100,
    rank: 1 + totals.filter((t) => t > totals[i]).length,
    group: highSet.has(i) ? 'High' : lowSet.has(i) ? 'Low' : 'Medium',
  }))
  const histogram = Array(k + 1).fill(0) as number[]
  totals.forEach((t) => histogram[t]++)
  const warnings: string[] = []
  if (cutoff.highTied > cutoff.highTakenFromTied)
    warnings.push(`${cutoff.highTied} students scored ${cutoff.highScore}, the cut-off between the High and Medium groups, but only ${cutoff.highTakenFromTied} fit in High. Those were chosen by their order in your file.`)
  if (cutoff.lowTied > cutoff.lowTakenFromTied)
    warnings.push(`${cutoff.lowTied} students scored ${cutoff.lowScore}, the cut-off between the Medium and Low groups, but only ${cutoff.lowTakenFromTied} fit in Low. Those were chosen by their order in your file.`)
  if (alpha === null) warnings.push('Every student has the same total score, so reliability (alpha) cannot be calculated.')
  return {
    n, k, nOptions: ds.nOptions, scores, totals, mean, variance, sd: Math.sqrt(variance), median, min: sorted[0], max: sorted[n - 1], order, g, nMedium: n - 2 * g, high, medium, low, cutoff, items, students, sumItemVar, alpha, alphaR, alphaRating: rateAlpha(alphaR), histogram, warnings, dataset: ds,
  }
}
