// Reads the responses (and the answer key, wherever it is), checks them strictly, and reports every problem with its exact cell.
// The answer key can be: a separate file, a sheet in the same workbook (down a column or across a row), a row labelled "Key"
// inside the Responses sheet, or typed in by the user. Every problem points to a cell the user can correct on the page.
import type { WorkbookData, SheetData, Issue, CheckResult, Dataset, Question, NeedsKey } from './types.ts'
import { norm, show, asLetter, isMulti, ref, colLetter, itemNumber, sheetKey, closest, list, LETTERS } from './text.ts'
import type { Cell } from './text.ts'
import { suggestKey } from './keyguess.ts'

const RESP_NAMES = ['responses', 'response']
const KEY_NAMES = ['answerkey', 'answers', 'key', 'answer']
const KEY_ROW = /^(answer ?key|key|model answers?|correct( answers?| ans\.?)?|answers?|ans\.?)$/
// Columns that are not questions (a second ID-like column, names, totals ...). They are skipped, and may carry the "Key" label.
const META_HEAD = /^(row ?type|type|kind|role|name|student( name)?|section|batch|group|class|roll( ?(no\.?|number))?|reg(istration)?( ?(no\.?|number))?|total|score|marks?|percent(age)?|remarks?|email|date|timestamp)$/
const NOT_STUDENT = /^(total|totals|sum|average|avg|mean|count|percent|percentage|%|max|min|median|sd|std)\b/
const HEAD_A = /^(questions?|items?|q\.?( ?(no\.?|number))?|question (no\.?|number)|sl\.? ?no\.?|s\.? ?no\.?|no\.?|#|number|id)$/
const HEAD_B = /^(answers?|ans\.?|correct( (answers?|option|ans\.?|choice|response))?|key|option|right answer|answer key)$/

export interface CheckOptions {
  /** Key typed on the page, by norm()-ed question heading. Used only when no key exists in the files. */
  typedKey?: Record<string, string>
}

function findSheet(wb: WorkbookData, names: string[]): SheetData | undefined {
  return wb.sheets.find((s) => names.includes(sheetKey(s.name)))
}
const width = (g: SheetData['grid']) => g.reduce((m, r) => Math.max(m, r.length), 0)
const rowHasData = (row: SheetData['grid'][number], w: number) => {
  for (let c = 0; c < w; c++) if (norm(row[c]) !== '') return true
  return false
}
/** A key letter: 'b', '(B)', 'Option B', and also 2 meaning B. */
/** 'b. syncytiotrophoblast', '(c) Nice', 'D) text' -> the letter the answer starts with. */
const leadLetter = (s: string): string | null => {
  const m = /^\(?([a-h])\s*[.):\-]\s*\S/.exec(s)
  return m ? m[1].toUpperCase() : null
}
const keyLetter = (s: string): string | null => (isMulti(s) ? null : asLetter(s) ?? (/^[1-8]$/.test(s) ? LETTERS[Number(s) - 1] : leadLetter(s)))

// ---------------------------------------------------------------- corrections made on the page
export type Edits = Record<string, string>
export const editKey = (file: string, sheet: string, cell: string) => `${file}|${sheet}|${cell}`
export const isSingleCell = (cell: string) => /^[A-Z]+\d+$/.test(cell)
export function parseRef(cell: string): { r: number; c: number } | null {
  const m = /^([A-Z]+)(\d+)$/.exec(cell)
  if (!m) return null
  let c = 0
  for (const ch of m[1]) c = c * 26 + ch.charCodeAt(0) - 64
  return { r: Number(m[2]) - 1, c: c - 1 }
}
/** Returns a copy of the workbook with the user's typed corrections applied. The original is never changed. */
export function applyEdits(wb: WorkbookData, edits: Edits): WorkbookData {
  const mine = Object.entries(edits).filter(([k]) => k.startsWith(`${wb.fileName}|`))
  if (mine.length === 0) return wb
  const sheets = wb.sheets.map((s) => ({ name: s.name, grid: s.grid.map((r) => [...r]) as Cell[][] }))
  for (const [k, v] of mine) {
    const [, sheet, cell] = k.split('|')
    const sh = sheets.find((s) => s.name === sheet)
    const p = parseRef(cell)
    if (!sh || !p) continue
    while (sh.grid.length <= p.r) sh.grid.push([])
    const row = sh.grid[p.r]
    while (row.length <= p.c) row.push(null)
    row[p.c] = v.trim() === '' ? null : v
  }
  return { fileName: wb.fileName, sheets }
}

interface Pair { q: Cell; a: Cell; qCell: string; aCell: string }

export function checkInputs(resp: WorkbookData, keyFile?: WorkbookData | null, opts: CheckOptions = {}): CheckResult {
  const issues: Issue[] = []
  const notes: string[] = []
  let rs: SheetData | undefined
  let ks: SheetData | undefined
  let keyFileUsed = false
  const fileOf = (sheet: string) => (keyFileUsed && keyFile && ks && sheet === ks.name ? keyFile.fileName : resp.fileName)
  const add = (severity: Issue['severity'], code: string, sheet: string, cell: string, found: string, problem: string, fix: string) =>
    issues.push({ severity, code, file: fileOf(sheet), sheet, cell, found, problem, fix })
  const done = (dataset?: Dataset, needsKey?: NeedsKey): CheckResult => ({ ok: !issues.some((i) => i.severity === 'error') && !!dataset, issues, notes, dataset, needsKey })

  // ---------- which sheets? ----------
  if (resp.sheets.length === 0) {
    add('error', 'EMPTY_FILE', resp.fileName, '', '', 'This file has no sheets with data.', 'Open it in Excel, check it contains your data, and save it again as .xlsx.')
    return done()
  }
  rs = findSheet(resp, RESP_NAMES)
  if (!rs) {
    if (resp.sheets.length === 1) {
      rs = resp.sheets[0]
      notes.push(`The only sheet in the responses file, "${rs.name}", was used as the responses.`)
    } else {
      add('error', 'NO_RESPONSES_SHEET', resp.fileName, '', '', `No sheet is named "Responses". Sheets in this file: ${list(resp.sheets.map((s) => s.name))}.`,
        'Rename the sheet that holds the students\' answers to Responses (right-click its tab at the bottom of Excel, then Rename).')
    }
  }
  let keySource = ''
  let keyKind: Dataset['keyKind'] = 'sheet'
  if (keyFile) {
    keyFileUsed = true
    ks = findSheet(keyFile, KEY_NAMES) ?? (keyFile.sheets.length === 1 ? keyFile.sheets[0] : undefined)
    if (keyFile.sheets.length === 0) add('error', 'EMPTY_FILE', keyFile.fileName, '', '', 'The answer-key file has no sheets with data.', 'Check the file and save it again as .xlsx.')
    else if (!ks) add('error', 'NO_KEY_SHEET', keyFile.fileName, '', '', `I can't tell which sheet holds the answers. Sheets in this file: ${list(keyFile.sheets.map((s) => s.name))}.`, 'Rename the sheet with the answers to Answer_Key, or keep only that one sheet in the file.')
    else { keySource = `${keyFile.fileName}, sheet "${ks.name}"`; keyKind = 'file' }
    if (findSheet(resp, KEY_NAMES) && findSheet(resp, KEY_NAMES) !== rs) notes.push('The responses workbook also has an Answer_Key sheet; the separately uploaded key file was used instead.')
  } else {
    ks = findSheet(resp, KEY_NAMES)
    if (ks && ks === rs) ks = undefined
    if (ks) keySource = `sheet "${ks.name}" of ${resp.fileName}`
  }
  if (!rs) return done()

  // ---------- Responses: headings ----------
  const sheet = rs.name
  const g = rs.grid
  const w = width(g)
  const hdr = Array.from({ length: w }, (_, c) => norm(g[0]?.[c]))
  const headCount = hdr.filter((h) => h !== '').length
  if (headCount < 2) {
    let hint = ''
    for (let r = 1; r < Math.min(g.length, 25); r++) {
      let n = 0
      for (let c = 0; c < w; c++) if (norm(g[r]?.[c]) !== '') n++
      if (n >= 3) { hint = ` What looks like the heading row is on row ${r + 1}.`; break }
    }
    add('error', 'NO_HEADINGS', sheet, 'A1', g[0] && headCount ? list(g[0].map(show).filter(Boolean)) : '(row 1 is empty)',
      `Row 1 must hold the headings: ID, Q1, Q2, Q3 …${hint}`, 'Delete any title or blank rows above the headings so that the headings are on row 1.')
    return done()
  }
  const qCols: number[] = []
  const metaCols: number[] = []
  const seen = new Map<string, number>()
  for (let c = 1; c < w; c++) {
    if (META_HEAD.test(hdr[c])) { metaCols.push(c); continue }
    if (hdr[c] === '') {
      if (g.slice(1).some((r) => norm(r?.[c]) !== ''))
        add('error', 'BLANK_HEADING', sheet, ref(0, c), '(empty)', `Column ${colLetter(c)} contains answers but has no heading.`, `Type the question name (for example Q${qCols.length + 1}) in ${ref(0, c)}, or delete the column.`)
      continue
    }
    if (seen.has(hdr[c])) {
      add('error', 'DUPLICATE_HEADING', sheet, ref(0, c), show(g[0][c]), `This is the same heading as ${ref(0, seen.get(hdr[c])!)}.`, 'Give every question its own heading (Q1, Q2, Q3 …).')
      continue
    }
    seen.set(hdr[c], c)
    qCols.push(c)
  }

  // ---------- Responses: students (and a row labelled Key, if there is one) ----------
  const rows: number[] = []
  const ids: string[] = []
  const idSeen = new Map<string, number>()
  let keyRow = -1
  let keyLabel = ''
  for (let r = 1; r < g.length; r++) {
    if (!rowHasData(g[r] ?? [], w)) continue
    const id = show(g[r][0])
    const idn = norm(g[r][0])
    const labelCol = [0, ...metaCols].find((c) => KEY_ROW.test(norm(g[r][c])))
    if (labelCol !== undefined) {
      if (keyRow < 0) { keyRow = r; keyLabel = show(g[r][labelCol]) }
      else add('warning', 'KEY_ROW_EXTRA', sheet, ref(r, labelCol), show(g[r][labelCol]), `A second answer-key row. The one on row ${keyRow + 1} is used.`, 'Delete this row if it is not needed.')
      continue
    }
    if (idn === '') { add('error', 'NO_ID', sheet, ref(r, 0), '(empty)', 'This student has no ID.', 'Give every student a unique anonymous ID (for example S001).'); continue }
    if (NOT_STUDENT.test(idn)) {
      add('error', 'NOT_A_STUDENT', sheet, ref(r, 0), id, 'This row looks like a summary row, not a student.', 'Delete the row. If it holds the correct answers, change the label in column A to Key.')
      continue
    }
    if (idSeen.has(idn)) { add('error', 'DUPLICATE_ID', sheet, ref(r, 0), id, `Same ID as ${ref(idSeen.get(idn)!, 0)}.`, 'Make every student ID different.'); continue }
    idSeen.set(idn, r)
    rows.push(r)
    ids.push(id)
  }
  if (qCols.length < 2) add('error', 'FEW_QUESTIONS', sheet, '', '', `Only ${qCols.length} question column(s) were found. At least 2 are needed.`, 'Put one question per column, starting in column B, each with a heading in row 1. If row 1 is a title, delete it so the headings are on row 1.')
  if (rows.length < 4 && !issues.some((i) => i.code === 'NO_ID' || i.code === 'NOT_A_STUDENT' || i.code === 'DUPLICATE_ID'))
    add('error', 'FEW_STUDENTS', sheet, '', '', `Only ${rows.length} student row(s) were found. At least 4 are needed.`, 'Check that the students start on row 2, one student per row.')

  // ---------- Responses: answers ----------
  const labels: string[] = []
  const questions: Question[] = qCols.map((c, n) => {
    const heading = show(g[0][c])
    let label = heading.length > 20 ? `Q${n + 1}` : heading
    if (labels.includes(label)) label = `Q${n + 1}`
    labels.push(label)
    return { label, heading, col: c }
  })
  const answers: string[][] = rows.map(() => [])
  const bad: { cell: string; found: string; multi: boolean }[] = []
  const norms = rows.map((r) => qCols.map((c) => norm(g[r][c])))
  const nonBlankVals = norms.flat().filter((x) => x !== '')
  // If every answer is a number from 1 to 8, the options were numbered: 1 is A, 2 is B ...
  const digitMode = nonBlankVals.length > 0 && nonBlankVals.every((x) => /^[1-8]$/.test(x))
  if (metaCols.length) notes.push(`${metaCols.length === 1 ? 'The column' : 'The columns'} ${list(metaCols.map((c) => `"${show(g[0][c])}"`))} ${metaCols.length === 1 ? 'is' : 'are'} not ${metaCols.length === 1 ? 'a question' : 'questions'} and ${metaCols.length === 1 ? 'was' : 'were'} skipped.`)
  if (digitMode) notes.push('Every answer is a number, so 1 was read as A, 2 as B, 3 as C and 4 as D.')
  let nonBlank = 0
  let blanks = 0
  let textMode = false
  const optText: string[][] = questions.map(() => [])
  const optIdx: Map<string, number>[] = questions.map(() => new Map())
  rows.forEach((r, si) => {
    qCols.forEach((c, qi) => {
      const s = norms[si][qi]
      if (s === '') { answers[si].push(''); blanks++; return }
      nonBlank++
      const L = digitMode ? LETTERS[Number(s) - 1] : isMulti(s) ? null : asLetter(s) ?? leadLetter(s)
      if (L === null) { answers[si].push('?'); bad.push({ cell: ref(r, c), found: show(g[r][c]), multi: isMulti(s) }) } else answers[si].push(L)
    })
  })
  const respErrors = issues.some((i) => i.severity === 'error')
  if (!respErrors && nonBlank === 0) add('error', 'NO_ANSWERS', sheet, '', '', 'The Responses sheet has no answers.', 'Enter the option letter each student chose (A, B, C or D).')
  else if (!respErrors && bad.length > 0.3 * nonBlank) {
    // Most answers are words, not letters: the students' answers are the option TEXT. Each distinct text becomes an option.
    textMode = true
    rows.forEach((_, si) => qCols.forEach((_c, qi) => {
      const t = norms[si][qi]
      if (t === '') { answers[si][qi] = ''; return }
      let idx = optIdx[qi].get(t)
      if (idx === undefined) { idx = optText[qi].length; optIdx[qi].set(t, idx); optText[qi].push(show(g[rows[si]][qCols[qi]])) }
      answers[si][qi] = idx < 8 ? LETTERS[idx] : '?'
    }))
    const over = questions.filter((_q, qi) => optText[qi].length > 8)
    if (over.length) add('error', 'TOO_MANY_OPTIONS', sheet, `${ref(1, over[0].col)}:${ref(rows[rows.length - 1], over[0].col)}`, list(over.map((q) => q.label)), `${over[0].label} has more than 8 different answers, so it looks like free text rather than a multiple-choice question.`, 'Remove columns that are not multiple-choice questions, or correct the spelling variants so that each option is written the same way.')
    else notes.push('The answers are written as words, not letters. Each different answer to a question was treated as one option, in the order they first appear (see the option list in the detailed report).')
  } else if (!respErrors) {
    for (const b of bad.slice(0, 200))
      add('warning', 'INVALID_ANSWER', sheet, b.cell, b.found, b.multi ? 'More than one option entered.' : 'This is not an option letter (A, B, C, D …).',
        'Type the single letter the student chose, or clear the cell if unanswered. Until then it is counted as wrong.')
    if (bad.length > 200) add('warning', 'INVALID_ANSWER', sheet, '', '', `${bad.length - 200} more answers are not option letters.`, 'Fix the ones listed above first, then check again to see the rest.')
  }

  // ---------- Answer key ----------
  const keyLetters: string[] = Array(questions.length).fill('')
  const byHead = new Map(questions.map((q, i) => [norm(q.heading), i] as const))
  const nums = questions.map((q) => itemNumber(norm(q.heading)))
  const byNum = new Map<number, number>()
  if (nums.every((n) => n !== null) && new Set(nums).size === nums.length) nums.forEach((n, i) => byNum.set(n as number, i))
  const resolve = (qn: string): number | undefined => {
    const nq = itemNumber(qn)
    return byHead.get(qn) ?? (nq !== null ? byNum.get(nq) : undefined)
  }

  type KeyRead = { L: string } | { problem: string; fix?: string }
  const readKey = (an: string, qi: number | undefined): KeyRead => {
    if (!textMode) {
      const L = keyLetter(an)
      return L ? { L } : { problem: isMulti(an) ? 'More than one answer is given. Only one correct option per question is supported.' : 'This is not a single option letter.' }
    }
    if (qi === undefined) return { L: 'A' }
    const idx = optIdx[qi].get(an)
    if (idx !== undefined) return { L: LETTERS[idx] }
    if (keyLetter(an)) return { problem: `The students' answers are written as words, but the key gives the letter "${an.toUpperCase()}".`, fix: `Type the correct option exactly as students wrote it, for example "${optText[qi][0] ?? ''}".` }
    const near = closest(an, [...optIdx[qi].keys()])
    if (near) return { problem: `No student wrote exactly this. The closest answer actually given is "${optText[qi][optIdx[qi].get(near)!]}".`, fix: `If that is the correct option, change this cell to exactly "${optText[qi][optIdx[qi].get(near)!]}".` }
    if (optText[qi].length >= 8) return { problem: 'This does not match any answer and there is no room for another option.' }
    optIdx[qi].set(an, optText[qi].length)
    optText[qi].push(an)
    return { L: LETTERS[optText[qi].length - 1] }
  }
  if (ks) {
    const kg = ks.grid
    const kw = width(kg)
    const ksheet = ks.name
    const nonEmpty = kg.map((row, r) => (rowHasData(row ?? [], kw) ? r : -1)).filter((r) => r >= 0)
    const r0 = nonEmpty[0]
    const r1 = nonEmpty[1]
    // Layout 1: headings across the top and the answers in the next row (Q1 Q2 Q3 … / A B C …)
    const across = r0 !== undefined && r1 !== undefined &&
      Array.from({ length: kw }, (_, c) => norm(kg[r0]?.[c])).filter((h) => h !== '' && resolve(h) !== undefined).length >= Math.max(2, Math.ceil(questions.length / 2))
    let dataPairs: Pair[] = []
    let layoutOk = true
    if (across) {
      for (let c = 0; c < kw; c++) if (norm(kg[r0]?.[c]) !== '') dataPairs.push({ q: kg[r0][c], a: kg[r1]?.[c], qCell: ref(r0, c), aCell: ref(r1, c) })
      // a label such as "Key" in the first column of the answer row is not a question heading
      dataPairs = dataPairs.filter((p) => resolve(norm(p.q)) !== undefined || !HEAD_A.test(norm(p.q)))
    } else {
      // Layout 2 (the usual one): Question in column A, Answer in column B
      const pairs: Pair[] = nonEmpty.map((r) => ({ q: kg[r][0], a: kg[r][1], qCell: ref(r, 0), aCell: ref(r, 1) }))
      if (pairs.length === 0 || kw < 2) {
        add('error', 'KEY_LAYOUT', ksheet, 'A1', '', 'The answer key needs two columns: Question in column A and Answer in column B.', 'Follow the template: row 1 = Question, Answer; then one row per question.')
        layoutOk = false
      } else {
        const a0 = norm(pairs[0].q)
        const b0 = norm(pairs[0].a)
        const rest = pairs.slice(1)
        const restLetters = rest.filter((x) => keyLetter(norm(x.a))).length / Math.max(1, rest.length)
        const header = HEAD_A.test(a0) || HEAD_B.test(b0) || (b0 !== '' && !keyLetter(b0) && restLetters >= 0.5)
        dataPairs = header ? rest : pairs
      }
    }
    if (layoutOk) {
      const keyAt: string[] = Array(questions.length).fill('')
      const firstCell: string[] = Array(questions.length).fill('')
      const errored = new Set<number>()
      const unmatched: { qCell: string; name: string }[] = []
      for (const { q, a, qCell, aCell } of dataPairs) {
        const qn = norm(q)
        const an = norm(a)
        if (qn === '') { add('error', 'KEY_NO_QUESTION', ksheet, qCell, '(empty)', `The answer "${show(a)}" has no question name next to it.`, `Type the question name in ${qCell}.`); continue }
        const qi = resolve(qn)
        if (an === '') { add('error', 'KEY_NO_ANSWER', ksheet, aCell, '(empty)', `${show(q)} has no answer.`, `Type the correct option letter in ${aCell}.`); if (qi !== undefined) errored.add(qi); continue }
        const kr = readKey(an, qi)
        if ('problem' in kr) {
          add('error', 'KEY_BAD_ANSWER', ksheet, aCell, show(a), kr.problem, kr.fix ?? `Change ${aCell} to one letter (A, B, C or D).`)
          if (qi !== undefined) errored.add(qi)
          continue
        }
        const L = kr.L
        if (qi === undefined) { unmatched.push({ qCell, name: show(q) }); continue }
        if (keyAt[qi]) { add('error', 'KEY_DUPLICATE', ksheet, qCell, show(q), `${questions[qi].label} already has an answer in ${firstCell[qi]}.`, 'Keep one answer per question and delete the other.'); continue }
        keyAt[qi] = L
        firstCell[qi] = aCell
        keyLetters[qi] = L
      }
      const missing = questions.map((_, i) => i).filter((i) => !keyAt[i] && !errored.has(i))
      if (missing.length === questions.length && unmatched.length > 0) {
        add('error', 'KEY_NO_MATCH', ksheet, unmatched[0].qCell, list(unmatched.map((u) => `"${u.name}"`), 3),
          `None of the question names in the key match the headings in Responses (which start: ${list(questions.map((q) => `"${q.heading}"`), 4)}).`,
          'The names in the key must be exactly the same as the headings in Responses row 1. Copy and paste them.')
      } else {
        for (const i of missing) {
          const hit = closest(questions[i].heading, unmatched.map((u) => u.name))
          const u = hit ? unmatched.find((x) => x.name === hit) : undefined
          if (u) {
            add('error', 'KEY_NAME_MISMATCH', ksheet, u.qCell, u.name, `This looks like ${questions[i].label} (${sheet}!${ref(0, questions[i].col)}) but is spelled differently.`, `Change ${u.qCell} to exactly "${questions[i].heading}".`)
            unmatched.splice(unmatched.indexOf(u), 1)
          } else {
            add('error', 'KEY_MISSING', ksheet, '', '', `${questions[i].label} (${sheet}!${ref(0, questions[i].col)}) has no answer in the key.`, `Add a row to ${ksheet} with "${questions[i].heading}" in column A and its correct letter in column B.`)
          }
        }
        for (const u of unmatched) add('warning', 'KEY_EXTRA', ksheet, u.qCell, u.name, 'This question is not a heading in Responses, so this row is ignored.', `If it should be used, change ${u.qCell} to match the heading in ${sheet} exactly.`)
      }
    }
    if (keyRow >= 0) notes.push(`The row labelled "${keyLabel}" in the Responses sheet was ignored because an answer-key sheet is present.`)
  } else if (keyRow >= 0) {
    // The key is a row of the Responses sheet, labelled Key
    keyKind = 'row'
    keySource = `the row labelled "${keyLabel}" (row ${keyRow + 1}) of the Responses sheet`
    questions.forEach((q, i) => {
      const cell = ref(keyRow, q.col)
      const raw = g[keyRow][q.col]
      const an = norm(raw)
      if (an === '') { add('error', 'KEY_NO_ANSWER', sheet, cell, '(empty)', `The Key row has no answer for ${q.label}.`, `Type the correct option letter in ${cell}.`); return }
      const kr = readKey(an, i)
      if ('problem' in kr) { add('error', 'KEY_BAD_ANSWER', sheet, cell, show(raw), kr.problem, kr.fix ?? `Change ${cell} to one letter (A, B, C or D).`); return }
      keyLetters[i] = kr.L
    })
  } else if (!respErrors && opts.typedKey) {
    keyKind = 'typed'
    keySource = 'the key chosen on this page'
    questions.forEach((q, i) => {
      const an = norm(opts.typedKey![norm(q.heading)] ?? '')
      const kr = an === '' ? ({ problem: '' } as KeyRead) : readKey(an, i)
      if ('problem' in kr) add('error', 'KEY_MISSING', 'Typed key', '', an, `${q.label} has no valid answer in the key you typed.`, 'Choose the correct option for every question.')
      else keyLetters[i] = kr.L
    })
  }

  const hasKey = !!ks || keyRow >= 0 || (!!opts.typedKey && !respErrors)
  if (!hasKey && !issues.some((i) => i.severity === 'error')) {
    add('error', 'NO_KEY', resp.fileName, '', '', 'No answer key was found. There is no row labelled "Key" in Responses, no sheet named "Answer_Key", and no separate key file.',
      'Add a row labelled Key in column A of Responses, add an Answer_Key sheet, upload the key as a separate file in step 2, or type it in the box on the page.')
    const hi = textMode ? Math.max(2, ...optText.map((o) => o.length)) : Math.max(4, ...answers.flat().map((x) => (x && x !== '?' ? LETTERS.indexOf(x) + 1 : 0)))
    const s = suggestKey(answers, hi)
    return done(undefined, { questions, suggested: s.key, confidence: s.confidence, nOptions: hi, optionText: textMode ? optText : undefined })
  }

  if (issues.some((i) => i.severity === 'error')) return done()

  // ---------- final dataset + advisory warnings ----------
  let hi = textMode ? 2 : 4
  if (textMode) for (const o of optText) hi = Math.max(hi, o.length)
  else {
    for (const row of answers) for (const x of row) if (x && x !== '?') hi = Math.max(hi, LETTERS.indexOf(x) + 1)
    for (const x of keyLetters) hi = Math.max(hi, LETTERS.indexOf(x) + 1)
  }
  const dataset: Dataset = { ids, studentRows: rows.map((r) => r + 1), questions, answers, key: keyLetters, nOptions: hi, keySource, keyKind,
    ...(textMode ? { textMode: true, optionText: optText, optionCount: optText.map((o) => Math.max(2, o.length)) } : {}) }
  notes.push(`${ids.length} students and ${questions.length} questions were read. The answer key came from ${keySource}. ${textMode ? `Up to ${hi} options per question were found.` : `${hi} options per question (A to ${LETTERS[hi - 1]}) are assumed.`}`)
  if (blanks) notes.push(`${blanks} blank answer(s) are counted as wrong.`)
  questions.forEach((q, j) => {
    if (new Set(answers.map((a) => a[j])).size === 1)
      add('warning', 'NO_VARIATION', sheet, `${ref(1, q.col)}:${ref(rows[rows.length - 1], q.col)}`, '', `Every student gave the same answer to ${q.label}, so it cannot separate strong from weak students.`, 'Check that the column was not copied down by mistake.')
  })
  if (ids.length < 30) add('warning', 'SMALL_GROUP', sheet, '', '', `Only ${ids.length} students. Reliability and discrimination figures are unstable in small groups.`, 'Treat the results as indicative.')
  return done(dataset)
}
