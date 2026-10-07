import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { checkInputs, applyEdits, editKey } from '../src/lib/check.ts'
import { suggestKey } from '../src/lib/keyguess.ts'
import { analyse, groupSize, rateDif, rateDi, rateDe, rateAlpha, decideAction } from '../src/lib/stats.ts'
import { roundHalfUp, fmt, signed } from '../src/lib/format.ts'
import { norm, asLetter, isMulti, colLetter, ref, itemNumber, closest } from '../src/lib/text.ts'
import type { Grid } from '../src/lib/text.ts'
import type { WorkbookData } from '../src/lib/types.ts'

const wb = (fileName: string, sheets: Record<string, Grid>): WorkbookData => ({ fileName, sheets: Object.entries(sheets).map(([name, grid]) => ({ name, grid })) })
const HDR = ['ID', 'Q1', 'Q2', 'Q3', 'Q4']
const KEYS = [['Question', 'Answer'], ['Q1', 'A'], ['Q2', 'B'], ['Q3', 'C'], ['Q4', 'D']]
const students = (n = 6): Grid => Array.from({ length: n }, (_, i) => [`S${i + 1}`, 'ABCD'[i % 4], 'B', 'C', 'ABCD'[(i + 1) % 4]])
const good = (): WorkbookData => wb('f.xlsx', { Responses: [HDR, ...students()], Answer_Key: KEYS })
const run = (w: WorkbookData, k?: WorkbookData) => checkInputs(w, k)
const codes = (r: ReturnType<typeof run>, sev?: string) => r.issues.filter((i) => !sev || i.severity === sev).map((i) => i.code)
const find = (r: ReturnType<typeof run>, code: string) => r.issues.find((i) => i.code === code)

// ---------------------------------------------------------------- parity with the Python engine
const fixtures = JSON.parse(readFileSync(new URL('./fixtures.json', import.meta.url), 'utf8'))
for (const f of fixtures) {
  test(`parity with Python: ${f.name}`, () => {
    const r = run(wb('x.xlsx', { Responses: f.responses, Answer_Key: f.key }))
    assert.ok(r.ok, JSON.stringify(r.issues.filter((i) => i.severity === 'error')))
    const a = analyse(r.dataset!)
    const e = f.expected
    assert.ok(Math.abs(a.alpha! - e.alpha) < 1e-9, `alpha ${a.alpha} vs ${e.alpha}`)
    assert.deepEqual(a.totals, e.totals)
    assert.ok(Math.abs(a.mean - e.mean) < 1e-9 && Math.abs(a.variance - e.var) < 1e-9)
    assert.equal(a.g, e.g)
    assert.deepEqual(a.high.map((i) => a.dataset.ids[i]).sort(), [...e.high].sort())
    assert.deepEqual(a.low.map((i) => a.dataset.ids[i]).sort(), [...e.low].sort())
    assert.equal(a.nMedium, e.medium); assert.equal(a.g * 2 + a.nMedium, a.n)
    a.items.forEach((it, j) => {
      const x = e.items[j]
      assert.equal(it.label, x.label)
      assert.ok(Math.abs(it.dif - x.dif) < 1e-9, `${it.label} dif`)
      assert.ok(Math.abs(it.di - x.di) < 1e-9, `${it.label} di`)
      assert.equal(it.nfd.length, x.nfd, `${it.label} nfd`)
      assert.ok(Math.abs(it.deR - x.de) < 1e-9, `${it.label} de`)  // Python stores DE rounded to 1 decimal
      assert.equal(it.correct, x.correct)
      assert.equal(it.highCorrect, x.high_correct); assert.equal(it.lowCorrect, x.low_correct)
      assert.ok(Math.abs(it.hlPercent - x.hl) < 1e-9, `${it.label} item analysis %`)
      for (const [o, p] of Object.entries(x.pct)) assert.ok(Math.abs(it.optionPct[o] - (p as number)) < 1e-9, `${it.label} option ${o}`)
      assert.ok(Math.abs((it.blank / a.n) * 100 - x.blank) <= 0.051 && Math.abs((it.invalid / a.n) * 100 - x.invalid) <= 0.051)
    })
  })
}

// ---------------------------------------------------------------- a tiny example worked by hand
test('hand-calculated example: alpha 0.75, DIF 75/50/25, DI 1', () => {
  const g: Grid = [['ID', 'Q1', 'Q2', 'Q3'], ['S1', 'A', 'A', 'A'], ['S2', 'A', 'A', 'B'], ['S3', 'A', 'B', 'B'], ['S4', 'B', 'B', 'B']]
  const r = run(wb('h.xlsx', { Responses: g, Answer_Key: [['Question', 'Answer'], ['Q1', 'A'], ['Q2', 'A'], ['Q3', 'A']] }))
  assert.ok(r.ok)
  const a = analyse(r.dataset!)
  assert.deepEqual(a.totals, [3, 2, 1, 0])
  assert.equal(a.mean, 1.5)
  assert.ok(Math.abs(a.variance - 5 / 3) < 1e-12)
  assert.deepEqual(a.items.map((i) => i.difR), [75, 50, 25])
  assert.deepEqual(a.items.map((i) => i.variance.toFixed(4)), ['0.2500', '0.3333', '0.2500'])
  assert.ok(Math.abs(a.sumItemVar - 5 / 6) < 1e-12)
  assert.ok(Math.abs(a.alpha! - 0.75) < 1e-12)
  assert.equal(a.g, 1)
  assert.deepEqual(a.items.map((i) => i.diR), [1, 1, 1])
  assert.deepEqual(a.items[0].nfd, ['C', 'D'])     // only B (25%) was chosen as a wrong option
  assert.ok(Math.abs(a.items[0].de - 100 / 3) < 1e-9)
})

// ---------------------------------------------------------------- numbers, groups, ratings
test('group size = floor(n/3); the remainder (0, 1 or 2) goes to Medium', () => {
  const want: Record<number, [number, number]> = { 4: [1, 2], 5: [1, 3], 6: [2, 2], 77: [25, 27], 100: [33, 34], 120: [40, 40], 200: [66, 68] }
  for (const [n, [g, m]] of Object.entries(want)) { assert.equal(groupSize(Number(n)), g, `n=${n}`); assert.equal(Number(n) - 2 * g, m, `medium n=${n}`) }
  for (let n = 4; n <= 400; n++) { const g = groupSize(n); assert.ok(g >= 1 && n - 2 * g >= g && n - 2 * g <= g + 2, `n=${n} g=${g}`) }
})
test('item analysis %: (High correct + Low correct) / (High total + Low total) x 100 — the 120-student example', () => {
  // 120 students -> 40 / 40 / 40.  32 High and 12 Low correct -> 44 / 80 = 55 %
  const ids = Array.from({ length: 120 }, (_, i) => `S${i + 1}`)
  const rows: Grid = ids.map((id, i) => {
    const hi = i < 40, lo = i >= 80
    const q1 = hi ? (i < 32 ? 'A' : 'B') : lo ? (i < 92 ? 'A' : 'B') : 'A'
    const filler = hi ? 'A' : lo ? 'B' : 'A' // makes High score more than Low on Q2 so the groups are defined by Q2 alone
    return [id, q1, filler]
  })
  const r = run(wb('x.xlsx', { Responses: [['ID', 'Q1', 'Q2'], ...rows], Answer_Key: [['Question', 'Answer'], ['Q1', 'A'], ['Q2', 'A']] }))
  const a = analyse(r.dataset!)
  assert.equal(a.g, 40); assert.equal(a.nMedium, 40)
  // Q1 is itself part of the total, so check the counts the engine reports against a direct count
  const it = a.items[0]
  const hc = a.high.filter((i) => a.dataset.answers[i][0] === 'A').length, lc = a.low.filter((i) => a.dataset.answers[i][0] === 'A').length
  assert.equal(it.highCorrect, hc); assert.equal(it.lowCorrect, lc); assert.equal(it.hlDenominator, 80)
  assert.ok(Math.abs(it.hlPercent - ((hc + lc) / 80) * 100) < 1e-12)
})
test('rounding is half-up and float-safe', () => {
  assert.equal(roundHalfUp(0.125, 2), 0.13)
  assert.equal(roundHalfUp(1.005, 2), 1.01)
  assert.equal(roundHalfUp(-0.125, 2), -0.13)
  assert.equal(roundHalfUp(70.04, 1), 70)
  assert.equal(fmt(0.1 + 0.2, 1), '0.3')
  assert.equal(signed(0.5), '+0.50')
  assert.equal(signed(-0.001), '0.00')
  assert.equal(fmt(-0.004, 2), '0.00')
})
test('rating thresholds', () => {
  assert.equal(rateDif(70).label, 'Acceptable'); assert.equal(rateDif(70.1).label, 'Too easy'); assert.equal(rateDif(30).label, 'Acceptable'); assert.equal(rateDif(29.9).label, 'Too difficult')
  assert.equal(rateDi(-0.01).label, 'Defective'); assert.equal(rateDi(0.19).label, 'Poor'); assert.equal(rateDi(0.2).label, 'Acceptable'); assert.equal(rateDi(0.3).label, 'Good'); assert.equal(rateDi(0.4).label, 'Excellent')
  assert.deepEqual([0, 1, 2, 3].map((n) => rateDe(n, 3).label), ['Excellent', 'Good', 'Needs revision', 'Poor'])
  assert.equal(rateDe(1, 1).label, 'Poor')       // true/false style: a single non-functional distractor
  assert.equal(rateAlpha(0.8).label, 'High reliability'); assert.equal(rateAlpha(0.7).level, 'warn'); assert.equal(rateAlpha(0.69).level, 'bad'); assert.equal(rateAlpha(null).level, 'bad')
})
test('action rules in order', () => {
  assert.equal(decideAction(-0.1, 0, ['good', 'bad', 'good']).rule.slice(0, 6), 'Rule 1')
  assert.equal(decideAction(0.1, 0, ['bad', 'bad', 'good']).rule.slice(0, 6), 'Rule 2')
  assert.equal(decideAction(0.1, 0, ['good', 'bad', 'good']).rule.slice(0, 6), 'Rule 3')
  assert.equal(decideAction(0.5, 1, ['good', 'good', 'warn']).rule.slice(0, 6), 'Rule 4')
  assert.equal(decideAction(0.25, 0, ['good', 'warn', 'good']).rule.slice(0, 6), 'Rule 5')
  assert.equal(decideAction(0.5, 0, ['good', 'good', 'good']).rule.slice(0, 6), 'Rule 6')
})
test('ranking: ties keep file order; tied rank; boundary tie warning', () => {
  const g: Grid = [['ID', 'Q1', 'Q2'], ...Array.from({ length: 10 }, (_, i) => [`S${i}`, 'A', i < 5 ? 'A' : 'B'])]
  const a = analyse(run(wb('t.xlsx', { Responses: g, Answer_Key: [['Question', 'Answer'], ['Q1', 'A'], ['Q2', 'A']] })).dataset!)
  assert.deepEqual(a.order, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
  assert.equal(a.g, 3); assert.equal(a.nMedium, 4)
  assert.deepEqual(a.high, [0, 1, 2]); assert.deepEqual(a.low, [7, 8, 9])
  assert.deepEqual(a.students.map((s) => s.rank), [1, 1, 1, 1, 1, 6, 6, 6, 6, 6])
  assert.equal(a.cutoff.highTied, 5); assert.equal(a.cutoff.highTakenFromTied, 3)
  assert.equal(a.warnings.length, 2)
})
test('alpha is undefined when every student has the same total', () => {
  const g: Grid = [['ID', 'Q1', 'Q2'], ...Array.from({ length: 5 }, (_, i) => [`S${i}`, 'A', 'A'])]
  const a = analyse(run(wb('t.xlsx', { Responses: g, Answer_Key: [['Question', 'Answer'], ['Q1', 'A'], ['Q2', 'A']] })).dataset!)
  assert.equal(a.alpha, null); assert.ok(a.warnings.some((w) => w.includes('alpha')))
})
test('text helpers', () => {
  assert.equal(norm('  Crohn\u2019s   DISEASE '), "crohn's disease"); assert.equal(norm('N/A'), ''); assert.equal(norm(2), '2'); assert.equal(norm(null), '')
  assert.equal(asLetter('(c)'), 'C'); assert.equal(asLetter('option b'), 'B'); assert.equal(asLetter('d.'), 'D'); assert.equal(asLetter('paris'), null); assert.equal(asLetter('i'), null); assert.equal(asLetter('ans'), null)
  assert.ok(isMulti('a,c')); assert.ok(isMulti('a and c')); assert.ok(!isMulti('a'))
  assert.equal(colLetter(0), 'A'); assert.equal(colLetter(25), 'Z'); assert.equal(colLetter(26), 'AA'); assert.equal(ref(6, 2), 'C7')
  assert.equal(itemNumber('q3'), 3); assert.equal(itemNumber('3.'), 3); assert.equal(itemNumber('question 12'), 12); assert.equal(itemNumber('qx'), null)
  assert.equal(closest('Q 3', ['Q1', 'Q3', 'Q10']), 'Q3'); assert.equal(closest('banana', ['Q1', 'Q2']), null)
})

// ---------------------------------------------------------------- valid layouts
test('valid workbook reads cleanly', () => {
  const r = run(good()); assert.ok(r.ok); assert.equal(r.dataset!.ids.length, 6); assert.deepEqual(r.dataset!.key, ['A', 'B', 'C', 'D']); assert.deepEqual(codes(r, 'error'), [])
})
test('letters typed loosely are accepted', () => {
  const g = students(); g[0][1] = ' a '; g[1][1] = '(b)'; g[2][1] = 'Option C'; g[3][1] = 'D.'
  const r = run(wb('f.xlsx', { Responses: [HDR, ...g], Answer_Key: KEYS })); assert.ok(r.ok); assert.deepEqual(r.dataset!.answers.slice(0, 4).map((x) => x[0]), ['A', 'B', 'C', 'D']); assert.ok(!codes(r).includes('INVALID_ANSWER'))
})
test('sheet names are forgiving about case, spaces and underscores', () => {
  assert.ok(run(wb('f.xlsx', { responses: [HDR, ...students()], 'Answer Key': KEYS })).ok)
  assert.ok(run(wb('f.xlsx', { Response: [HDR, ...students()], Answers: KEYS })).ok)
  assert.ok(run(wb('f.xlsx', { Notes: [['hi']], Responses: [HDR, ...students()], Answer_Key: KEYS, Old: [[1]] })).ok)
})
test('separate key file; and the only sheet in a file is used', () => {
  const r = run(wb('resp.xlsx', { Sheet1: [HDR, ...students()] }), wb('key.xlsx', { Sheet1: KEYS }))
  assert.ok(r.ok, JSON.stringify(r.issues)); assert.ok(r.dataset!.keySource.includes('key.xlsx')); assert.ok(r.notes.some((n) => n.includes('Sheet1')))
  const both = run(good(), wb('key.xlsx', { Answer_Key: [['Question', 'Answer'], ['Q1', 'B'], ['Q2', 'B'], ['Q3', 'C'], ['Q4', 'D']] }))
  assert.equal(both.dataset!.key[0], 'B'); assert.ok(both.notes.some((n) => n.includes('separately uploaded')))
})
test('Q 2 and Q.2 count as Q2', () => {
  assert.ok(run(wb('f.xlsx', { Responses: [HDR, ...students()], Answer_Key: [['Question', 'Answer'], ['Q 1', 'A'], ['q.2', 'B'], ['Question 3', 'C'], ['4.', 'D']] })).ok)
})
test('key may use numbers, have no header, odd header words, and leading blank rows', () => {
  assert.ok(run(wb('f.xlsx', { Responses: [HDR, ...students()], Answer_Key: [['No', 'Correct'], [1, 'A'], [2, 'B'], [3, 'C'], [4, 'D']] })).ok)
  assert.ok(run(wb('f.xlsx', { Responses: [HDR, ...students()], Answer_Key: KEYS.slice(1) })).ok)
  assert.ok(run(wb('f.xlsx', { Responses: [HDR, ...students()], Answer_Key: [['Q.No', 'Correct Ans.'], ...KEYS.slice(1)] })).ok)
  assert.ok(run(wb('f.xlsx', { Responses: [HDR, ...students()], Answer_Key: [[null], [null], ...KEYS] })).ok)
  assert.ok(run(wb('f.xlsx', { Responses: [HDR, ...students()], Answer_Key: [['  q1 ', ' a '], ['Q2', 'b'], ['Q3', 'C'], ['Q4', 'D']] })).ok)
})
test('long question text as headings becomes Q1, Q2 …', () => {
  const longs = HDR.slice(1).map((_, i) => `Which of the following best describes finding number ${i + 1}?`)
  const r = run(wb('f.xlsx', { Responses: [['ID', ...longs], ...students()], Answer_Key: [['Question', 'Answer'], ...longs.map((l, i) => [l, 'ABCD'[i]])] }))
  assert.ok(r.ok); assert.deepEqual(r.dataset!.questions.map((q) => q.label), ['Q1', 'Q2', 'Q3', 'Q4']); assert.equal(r.dataset!.questions[0].heading, longs[0])
})
test('blank rows between students are ignored; five options detected', () => {
  const g = students(8); g[2][1] = 'E'
  const r = run(wb('f.xlsx', { Responses: [HDR, ...g.slice(0, 3), [null, null], ...g.slice(3)], Answer_Key: KEYS }))
  assert.ok(r.ok); assert.equal(r.dataset!.ids.length, 8); assert.equal(r.dataset!.nOptions, 5)
})
test('Excel row numbers refer to the real rows', () => {
  const r = run(wb('f.xlsx', { Responses: [HDR, ...students(3), [null], ...students(3).map((s, i) => [`T${i}`, ...s.slice(1)])], Answer_Key: KEYS }))
  assert.deepEqual(r.dataset!.studentRows, [2, 3, 4, 6, 7, 8])
})

// ---------------------------------------------------------------- problems in Responses: exact cells
test('sheet problems', () => {
  const none = run(wb('f.xlsx', { Data: [HDR], Stuff: KEYS })); assert.deepEqual(codes(none, 'error'), ['NO_RESPONSES_SHEET'])
  assert.ok(none.issues[0].problem.includes('Data, Stuff'))
  const nokey = run(wb('f.xlsx', { Responses: [HDR, ...students()] })); assert.deepEqual(codes(nokey, 'error'), ['NO_KEY']); assert.ok(nokey.issues[0].fix.includes('step 2'))
  assert.deepEqual(codes(run({ fileName: 'e.xlsx', sheets: [] }), 'error'), ['EMPTY_FILE'])
  const k2 = run(good(), wb('k.xlsx', { A: KEYS, B: KEYS })); assert.deepEqual(codes(k2, 'error'), ['NO_KEY_SHEET'])
})
test('title row above headings points to the right row', () => {
  const r = run(wb('f.xlsx', { Responses: [['Pathology exam 2025'], [null], HDR, ...students()], Answer_Key: KEYS }))
  const i = find(r, 'NO_HEADINGS')!; assert.equal(i.cell, 'A1'); assert.ok(i.problem.includes('row 3'))
  assert.equal(find(run(wb('f.xlsx', { Responses: [[null, null], HDR, ...students()], Answer_Key: KEYS })), 'NO_HEADINGS')!.found, '(row 1 is empty)')
})
test('blank and duplicate headings', () => {
  const g = [['ID', 'Q1', 'Q2', 'Q1', null, 'Q5'], ...students().map((s) => [...s, 'A', 'B'])]
  const r = run(wb('f.xlsx', { Responses: g, Answer_Key: KEYS }))
  assert.equal(find(r, 'DUPLICATE_HEADING')!.cell, 'D1'); assert.ok(find(r, 'DUPLICATE_HEADING')!.problem.includes('B1')); assert.equal(find(r, 'BLANK_HEADING')!.cell, 'E1')
})
test('ID problems', () => {
  const g = students(9); g[3][0] = null; g[5][0] = g[1][0]; g[6][0] = 'Total'
  const r = run(wb('f.xlsx', { Responses: [HDR, ...g], Answer_Key: KEYS }))
  assert.equal(find(r, 'NO_ID')!.cell, 'A5'); const d = find(r, 'DUPLICATE_ID')!; assert.equal(d.cell, 'A7'); assert.ok(d.problem.includes('A3')); assert.equal(find(r, 'NOT_A_STUDENT')!.cell, 'A8')
})
test('too few students or questions', () => {
  assert.ok(codes(run(wb('f.xlsx', { Responses: [HDR, ...students(3)], Answer_Key: KEYS })), 'error').includes('FEW_STUDENTS'))
  assert.ok(codes(run(wb('f.xlsx', { Responses: [['ID', 'Q1'], ...students().map((s) => s.slice(0, 2))], Answer_Key: KEYS })), 'error').includes('FEW_QUESTIONS'))
})
test('invalid answers are reported cell by cell and counted wrong', () => {
  const g = students(); g[2][2] = 'Z'; g[4][3] = 'A,C'; g[0][4] = 5
  const r = run(wb('f.xlsx', { Responses: [HDR, ...g], Answer_Key: KEYS }))
  assert.ok(r.ok)                       // warnings only: the analysis can still run
  const w = r.issues.filter((i) => i.code === 'INVALID_ANSWER')
  assert.deepEqual(w.map((i) => [i.cell, i.found]).sort(), [['C4', 'Z'], ['D6', 'A,C'], ['E2', '5']])
  assert.deepEqual(new Set(w.map((i) => i.cell)), new Set(['C4', 'D6', 'E2']))
  assert.ok(w.find((i) => i.cell === 'D6')!.problem.includes('More than one'))
  assert.equal(r.dataset!.answers[2][1], '?')
  assert.equal(analyse(r.dataset!).scores[2][1], 0)
})
test('answers written as words: each distinct text is an option; the key must be one of the texts', () => {
  const T: Record<string, string> = { A: 'Paris', B: 'Lyon', C: 'Nice', D: 'Metz' }
  const words = students().map((s) => [s[0], ...s.slice(1).map((x) => T[x as string])])
  const r = run(wb('f.xlsx', { Responses: [HDR, ['Key', 'Paris', 'Lyon', 'Nice', 'Metz'], ...words] }))
  assert.ok(r.ok, JSON.stringify(r.issues)); assert.equal(r.dataset!.textMode, true)
  assert.ok(r.dataset!.optionText![0].includes('Paris'))
  const a = analyse(r.dataset!); assert.equal(a.items[0].key, a.dataset.key[0]); assert.ok(a.items.every((i) => i.nOpt >= 2))
  // a letter key with word answers cannot be matched: say so, at the exact cell
  const bad = run(wb('f.xlsx', { Responses: [HDR, ['Key', 'A', 'B', 'C', 'D'], ...words] }))
  assert.ok(!bad.ok); assert.deepEqual(bad.issues.map((i) => i.code), ['KEY_BAD_ANSWER', 'KEY_BAD_ANSWER', 'KEY_BAD_ANSWER', 'KEY_BAD_ANSWER']); assert.equal(bad.issues[0].cell, 'B2')
  // a misspelt key is matched to the closest answer actually given
  const typo = run(wb('f.xlsx', { Responses: [HDR, ['Key', 'Pariss', 'Lyon', 'Nice', 'Metz'], ...words] }))
  assert.ok(typo.issues[0].problem.includes('"Paris"'))
  // "B. text" answers are letters with text after them
  const lead = run(wb('f.xlsx', { Responses: [HDR, ['Key', 'A', 'B', 'C', 'D'], ...students().map((s) => [s[0], ...s.slice(1).map((x) => `${x}. ${T[x as string]}`)])] }))
  assert.ok(lead.ok && lead.dataset!.textMode !== true)
  assert.ok(run(wb('f.xlsx', { Responses: [HDR, ...students().map((s) => [s[0], 1, 2, 3, 4])], Answer_Key: KEYS })).ok)   // all numbers: read as A, B, C, D
  assert.ok(find(run(wb('f.xlsx', { Responses: [HDR, ...students().map((s) => [s[0], null, null, null, null])], Answer_Key: KEYS })), 'NO_ANSWERS'))
})

// ---------------------------------------------------------------- problems in the key: exact cells
test('key answers: blank, several letters, words', () => {
  const k = [['Question', 'Answer'], ['Q1', 'A,C'], ['Q2', null], ['Q3', 'Paris'], ['Q4', 'D']]
  const r = run(wb('f.xlsx', { Responses: [HDR, ...students()], Answer_Key: k }))
  assert.equal(find(r, 'KEY_BAD_ANSWER')!.cell, 'B2'); assert.ok(r.issues.filter((i) => i.code === 'KEY_BAD_ANSWER').some((i) => i.cell === 'B4' && i.found === 'Paris'))
  assert.equal(find(r, 'KEY_NO_ANSWER')!.cell, 'B3')
  assert.ok(r.issues.filter((i) => i.sheet === 'Answer_Key').every((i) => i.fix.length > 10))
})
test('key names: misspelt, missing, duplicate, extra, and nothing matching', () => {
  const sp = run(wb('f.xlsx', { Responses: [HDR, ...students()], Answer_Key: [['Question', 'Answer'], ['Q1', 'A'], ['Q-2', 'B'], ['Q3', 'C'], ['Q4', 'D']] }))
  const m = find(sp, 'KEY_NAME_MISMATCH')!; assert.equal(m.cell, 'A3'); assert.ok(m.fix.includes('"Q2"')); assert.ok(!codes(sp).includes('KEY_EXTRA'))
  const miss = run(wb('f.xlsx', { Responses: [HDR, ...students()], Answer_Key: KEYS.slice(0, 4) })); const mi = find(miss, 'KEY_MISSING')!
  assert.ok(mi.problem.includes('Q4') && mi.problem.includes('E1') && mi.fix.includes('Answer_Key'))
  const dup = run(wb('f.xlsx', { Responses: [HDR, ...students()], Answer_Key: [...KEYS, ['Q1', 'B']] })); assert.equal(find(dup, 'KEY_DUPLICATE')!.cell, 'A6')
  const extra = run(wb('f.xlsx', { Responses: [HDR, ...students()], Answer_Key: [...KEYS, ['Q9', 'B']] })); assert.ok(extra.ok); const ex = find(extra, 'KEY_EXTRA')!; assert.equal(ex.cell, 'A6'); assert.equal(ex.severity, 'warning')
  const none = run(wb('f.xlsx', { Responses: [HDR, ...students()], Answer_Key: [['Question', 'Answer'], ...HDR.slice(1).map((_, i) => [`What is finding ${i + 1}?`, 'A'])] }))
  const nm = find(none, 'KEY_NO_MATCH')!; assert.equal(nm.cell, 'A2'); assert.ok(nm.problem.includes('Q1') && nm.fix.includes('Copy and paste'))
  assert.ok(find(run(wb('f.xlsx', { Responses: [HDR, ...students()], Answer_Key: [['Question'], ['Q1']] })), 'KEY_LAYOUT'))
  assert.ok(find(run(wb('f.xlsx', { Responses: [HDR, ...students()], Answer_Key: [['Question', 'Answer'], [null, 'A'], ...KEYS.slice(1)] })), 'KEY_NO_QUESTION')!.cell === 'A2')
})
test('advisory warnings', () => {
  const g = students(6).map((s) => [s[0], 'A', ...s.slice(2)])
  const r = run(wb('f.xlsx', { Responses: [HDR, ...g], Answer_Key: KEYS }))
  const v = find(r, 'NO_VARIATION')!; assert.equal(v.cell, 'B2:B7'); assert.ok(codes(r).includes('SMALL_GROUP'))
})
test('every issue says where and what to do', () => {
  const g = students(9); g[3][0] = null; g[2][2] = 'Z'
  const r = run(wb('f.xlsx', { Responses: [HDR, ...g], Answer_Key: [['Question', 'Answer'], ['Q1', null]] }))
  for (const i of r.issues) { assert.ok(i.sheet && i.problem && i.fix, JSON.stringify(i)); assert.ok(i.severity === 'error' || i.severity === 'warning') }
})

test('the shipped template passes untouched', () => {
  const t = JSON.parse(readFileSync(new URL('./template.json', import.meta.url), 'utf8')) as Record<string, Grid>
  const r = run(wb('MCQ_Template.xlsx', t))
  assert.ok(r.ok, JSON.stringify(r.issues))
  assert.equal(r.dataset!.ids.length, 12); assert.equal(r.dataset!.questions.length, 6)
  const a = analyse(r.dataset!); assert.equal(a.items.length, 6); assert.ok(a.alpha === null || Number.isFinite(a.alpha))
})

// ---------------------------------------------------------------- the key can live in many places
test('responses only, with a row labelled Key (top, bottom, any wording)', () => {
  for (const label of ['Key', 'ANSWER KEY', 'Answers', 'Correct']) {
    for (const at of ['top', 'bottom']) {
      const keyRow = [label, 'A', 'B', 'C', 'D']
      const g = at === 'top' ? [HDR, keyRow, ...students()] : [HDR, ...students(), keyRow]
      const r = run(wb('f.xlsx', { Responses: g }))
      assert.ok(r.ok, `${label}/${at} ${JSON.stringify(r.issues)}`); assert.deepEqual(r.dataset!.key, ['A', 'B', 'C', 'D']); assert.equal(r.dataset!.ids.length, 6); assert.equal(r.dataset!.keyKind, 'row')
    }
  }
})
test('Key row: blank or invalid cells point to the exact cell; extra Key row warns', () => {
  const r = run(wb('f.xlsx', { Responses: [HDR, ['Key', 'A', null, 'Paris', 'D'], ...students()] }))
  assert.deepEqual(r.issues.map((i) => [i.code, i.cell]), [['KEY_NO_ANSWER', 'C2'], ['KEY_BAD_ANSWER', 'D2']])
  const two = run(wb('f.xlsx', { Responses: [HDR, ['Key', 'A', 'B', 'C', 'D'], ...students(), ['Key', 'B', 'B', 'B', 'B']] }))
  assert.ok(two.ok); assert.ok(codes(two).includes('KEY_ROW_EXTRA')); assert.equal(two.dataset!.key[0], 'A')
})
test('Answer_Key sheet beats a Key row; uploaded key file beats both', () => {
  const r = run(wb('f.xlsx', { Responses: [HDR, ['Key', 'D', 'D', 'D', 'D'], ...students()], Answer_Key: KEYS }))
  assert.deepEqual(r.dataset!.key, ['A', 'B', 'C', 'D']); assert.ok(r.notes.some((n) => n.includes('was ignored')))
})
test('key written across a row in its own sheet', () => {
  const r = run(wb('f.xlsx', { Responses: [HDR, ...students()], Answer_Key: [HDR.slice(1), ['A', 'B', 'C', 'D']] }))
  assert.ok(r.ok, JSON.stringify(r.issues)); assert.deepEqual(r.dataset!.key, ['A', 'B', 'C', 'D'])
  const lab = run(wb('f.xlsx', { Responses: [HDR, ...students()], Answer_Key: [['Question', ...HDR.slice(1)], ['Key', 'A', 'B', null, 'D']] }))
  assert.deepEqual(lab.issues.map((i) => [i.code, i.cell]), [['KEY_NO_ANSWER', 'D2']])
})
test('no key anywhere: asks for it and offers a draft worked out from the answers', () => {
  const g = Array.from({ length: 30 }, (_, i) => [`S${i}`, i < 24 ? 'A' : 'B', i < 20 ? 'B' : 'C', i < 25 ? 'C' : 'A', 'D'])
  const r = run(wb('f.xlsx', { Responses: [HDR, ...g] }))
  assert.ok(!r.ok); assert.ok(r.needsKey); assert.deepEqual(codes(r, 'error'), ['NO_KEY']); assert.deepEqual(r.needsKey!.suggested, ['A', 'B', 'C', 'D'])
  const typed = checkInputs(wb('f.xlsx', { Responses: [HDR, ...g] }), null, { typedKey: { q1: 'a', q2: 'B', q3: 'c', q4: 'D' } })
  assert.ok(typed.ok); assert.equal(typed.dataset!.keyKind, 'typed'); assert.deepEqual(typed.dataset!.key, ['A', 'B', 'C', 'D'])
  const partial = checkInputs(wb('f.xlsx', { Responses: [HDR, ...g] }), null, { typedKey: { q1: 'a' } })
  assert.ok(!partial.ok); assert.deepEqual(codes(partial, 'error'), ['KEY_MISSING', 'KEY_MISSING', 'KEY_MISSING'])
})
test('draft key is only a guess: it follows the strongest students and reports how sure it is', () => {
  // Q1: strong students all pick A, the rest are split; Q2: nobody agrees.
  const strong = Array.from({ length: 4 }, () => ['A', 'A', 'A'])
  const rest = Array.from({ length: 8 }, (_, i) => [i % 2 ? 'A' : 'B', 'B', i % 4 === 0 ? 'C' : 'A'])
  const s = suggestKey([...strong, ...rest], 4)
  assert.equal(s.key[0], 'A'); assert.ok(s.confidence.every((c) => c >= 0 && c <= 1)); assert.equal(s.confidence[0], 1)
})
test('numbered options: 1 to 4 are read as A to D (answers and key)', () => {
  const g = students().map((s) => [s[0], ...s.slice(1).map((x) => 'ABCD'.indexOf(x as string) + 1)])
  const r = run(wb('f.xlsx', { Responses: [HDR, ['Key', 1, 2, 3, 4], ...g] }))
  assert.ok(r.ok, JSON.stringify(r.issues)); assert.deepEqual(r.dataset!.key, ['A', 'B', 'C', 'D']); assert.ok(r.notes.some((n) => n.includes('1 was read as A')))
})
test('corrections typed on the page are applied to a copy, in the right file and cell', () => {
  const g = students(); g[2][2] = 'Z'
  const w0 = wb('f.xlsx', { Responses: [HDR, ['Key', 'A', 'B', null, 'D'], ...g] })
  const first = run(w0); assert.ok(!first.ok)
  const fixed = applyEdits(w0, { [editKey('f.xlsx', 'Responses', 'D2')]: 'c', [editKey('f.xlsx', 'Responses', 'C5')]: 'B' })
  assert.equal(w0.sheets[0].grid[1][3], null)                               // original untouched
  const r = run(fixed); assert.ok(r.ok, JSON.stringify(r.issues)); assert.equal(r.dataset!.key[2], 'C'); assert.ok(!codes(r).includes('INVALID_ANSWER'))
  assert.equal(applyEdits(w0, { [editKey('other.xlsx', 'Responses', 'D2')]: 'C' }), w0)   // an edit for another file is ignored
})

test('layout with a "Row Type" column and the key row labelled in column B (as in a converted sheet)', () => {
  const g: Grid = [['ID', 'Row Type', ...HDR.slice(1)], [1, 'ANSWER KEY', 'A', 'B', 'C', 'D'], ...students().map((s, i) => [i + 2, 'STUDENT', ...s.slice(1)])]
  const r = run(wb('f.xlsx', { Responses: g }))
  assert.ok(r.ok, JSON.stringify(r.issues)); assert.equal(r.dataset!.ids.length, 6); assert.deepEqual(r.dataset!.key, ['A', 'B', 'C', 'D']); assert.equal(r.dataset!.questions.length, 4)
  assert.ok(r.notes.some((n) => n.includes('Row Type')))
})

// ---------------------------------------------------------------- the AI number checker
import { verifyText, plainSummary } from '../src/lib/ai.ts'
test('AI checker: accepts real numbers and labels, rejects invented ones', () => {
  const a = analyse(run(wb('f.xlsx', { Responses: [HDR, ['Key', 'A', 'B', 'C', 'D'], ...students(9)] })).dataset!)
  const it = a.items[0]
  const ok = `${a.n} students sat the paper. Q1 had an item analysis of ${it.hlPercent.toFixed(1)} percent.`
  assert.deepEqual(verifyText(ok, a), [])
  assert.ok(verifyText('Q1 was answered correctly by 73 percent.', a).length > 0)
  assert.ok(verifyText('Q9 looks weak.', a).length > 0)
  assert.deepEqual(verifyText(plainSummary(a), a), [])
})
