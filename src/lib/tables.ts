// Plain tables for the Excel download. Pure, so it can be tested.
import type { Analysis } from './stats.ts'
import { LETTERS } from './text.ts'
import { fmt, roundHalfUp } from './format.ts'

export interface SheetTable { name: string; rows: (string | number)[][] }

export const displayId = (a: Analysis, i: number, hide: boolean) => (hide ? `Student ${i + 1}` : a.dataset.ids[i])

export function exportTables(a: Analysis, hideIds: boolean): SheetTable[] {
  const letters = LETTERS.slice(0, a.nOptions).split('')
  const r = (x: number, d: number) => roundHalfUp(x, d)
  return [
    {
      name: 'Summary',
      rows: [
        ['Measure', 'Value'], ['Students', a.n], ['Questions', a.k], ['Options per question', a.nOptions],
        ['Mean total score', r(a.mean, 2)], ['Median', a.median], ['Standard deviation', r(a.sd, 2)], ['Lowest', a.min], ['Highest', a.max],
        ["Cronbach's alpha", a.alphaR ?? 'not defined'], ['Reliability rating', a.alphaRating.label], ['High group size', a.g], ['Medium group size', a.nMedium], ['Low group size', a.g], ['Answer key from', a.dataset.keySource],
      ],
    },
    {
      name: 'Items',
      rows: [
        ['Item', 'Heading', 'Key', 'Correct', 'Students', 'Difficulty %', 'Difficulty rating', 'High correct', 'Low correct', 'High total', 'Low total', 'Item analysis % (High+Low)', 'Discrimination', 'Discrimination rating',
          'Non-functional distractors', 'Distractor efficiency %', 'Distractor rating', 'Recommended action', 'Rule applied'],
        ...a.items.map((i) => [i.label, i.heading, i.key, i.correct, a.n, i.difR, i.difRating.label, i.highCorrect, i.lowCorrect, a.g, a.g, r(i.hlPercent, 1), i.diR, i.diRating.label,
          i.nfd.join(', ') || 'none', i.deR, i.deRating.label, i.action.text, i.action.rule]),
      ],
    },
    {
      name: 'Distractors',
      rows: [
        ['Item', 'Key', ...letters.map((l) => `${l} %`), 'Blank %', 'Invalid %'],
        ...a.items.map((i) => [i.label, i.key, ...letters.map((l) => (i.optionPct[l] === undefined ? '' : r(i.optionPct[l], 1))), r((i.blank / a.n) * 100, 1), r((i.invalid / a.n) * 100, 1)]),
      ],
    },
    {
      name: 'Students',
      rows: [['Rank', 'Student', 'Total score', 'Percent', 'Group'], ...[...a.students].sort((x, y) => a.order.indexOf(x.index) - a.order.indexOf(y.index)).map((s) => [s.rank, displayId(a, s.index, hideIds), s.total, r(s.percent, 1), s.group])],
    },
    {
      name: 'Alpha working',
      rows: [
        ['Item', 'Correct (c)', 'p = c/n', 'q = 1-p', 'Variance = n*p*q/(n-1)'],
        ...a.items.map((i) => [i.label, i.correct, Number(fmt(i.p, 4)), Number(fmt(1 - i.p, 4)), Number(fmt(i.variance, 4))]),
        ['Sum of item variances', '', '', '', Number(fmt(a.sumItemVar, 4))], ['Variance of total scores', '', '', '', Number(fmt(a.variance, 4))], ["Cronbach's alpha", '', '', '', a.alphaR ?? 'not defined'],
      ],
    },
    { name: 'Scored 0-1', rows: [['Student', ...a.items.map((i) => i.label), 'Total'], ...a.scores.map((row, s) => [displayId(a, s, hideIds), ...row, a.totals[s]])] },
    { name: 'Answers', rows: [['Student', ...a.items.map((i) => i.label)], ...a.dataset.answers.map((row, s) => [displayId(a, s, hideIds), ...row])] },
  ]
}
