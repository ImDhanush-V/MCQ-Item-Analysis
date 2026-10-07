// A DRAFT answer key worked out from the students' own answers. It is only a suggestion for the teacher to confirm.
// Idea: the most common answer to a question is usually the right one, and the strongest students are right more often.
// Pass 1 uses everybody; pass 2 and 3 score students with the draft key and take the most common answer among the top third.
import { LETTERS } from './text.ts'

export function suggestKey(answers: string[][], nOptions: number): { key: string[]; confidence: number[] } {
  const n = answers.length
  const k = answers[0]?.length ?? 0
  const letters = LETTERS.slice(0, nOptions).split('')
  const modal = (rows: string[][], j: number) => {
    const counts = letters.map((L) => rows.filter((r) => r[j] === L).length)
    const best = Math.max(...counts)
    return { letter: counts.every((c) => c === 0) ? '' : letters[counts.indexOf(best)], share: rows.length ? best / rows.length : 0 }
  }
  let key = Array.from({ length: k }, (_, j) => modal(answers, j).letter)
  const g = Math.max(1, Math.floor(n / 3))
  for (let pass = 0; pass < 2; pass++) {
    const totals = answers.map((r) => r.reduce((a, x, j) => a + (x !== '' && x === key[j] ? 1 : 0), 0))
    const order = totals.map((_, i) => i).sort((a, b) => totals[b] - totals[a] || a - b)
    const top = order.slice(0, g).map((i) => answers[i])
    key = Array.from({ length: k }, (_, j) => modal(top, j).letter || key[j])
  }
  const totals = answers.map((r) => r.reduce((a, x, j) => a + (x !== '' && x === key[j] ? 1 : 0), 0))
  const order = totals.map((_, i) => i).sort((a, b) => totals[b] - totals[a] || a - b)
  const top = order.slice(0, g).map((i) => answers[i])
  const confidence = key.map((L, j) => (top.length ? top.filter((r) => r[j] === L).length / top.length : 0))
  return { key, confidence }
}
