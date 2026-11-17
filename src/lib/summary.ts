// Plain-language summary written by fixed rules (no AI).
import { fmt } from './format'
import type { Analysis } from './stats'

export function plainSummary(a: Analysis): string {
  const good = a.items.filter((i) => i.action.level === 'good')
  const bad = a.items.filter((i) => i.action.level === 'bad')
  const rel = a.alpha === null
    ? 'Reliability could not be worked out because every student scored the same.'
    : `Reliability (Cronbach's alpha) is ${fmt(a.alpha, 2)}, which is rated "${a.alphaRating.label.toLowerCase()}".`
  const hard = a.items.filter((i) => i.difRating.label === 'Difficult').map((i) => i.label)
  const easy = a.items.filter((i) => i.difRating.label === 'Easy').map((i) => i.label)
  const p1 = `${a.n} students answered ${a.k} questions; the average score was ${fmt(a.mean, 1)}. ${rel}`
  const p2 = `${good.length} question${good.length === 1 ? ' is' : 's are'} fine to keep as they are. ${bad.length ? `These need revision: ${bad.map((i) => `${i.label} (${i.action.text.toLowerCase()})`).join('; ')}.` : 'No question is flagged for revision.'}${easy.length ? ` Easy: ${easy.join(', ')}.` : ''}${hard.length ? ` Difficult: ${hard.join(', ')}.` : ''}`
  return `${p1}\n\n${p2}`
}

