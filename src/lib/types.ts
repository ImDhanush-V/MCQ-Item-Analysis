import type { Grid } from './text.ts'

export interface SheetData { name: string; grid: Grid }          // grid[0][0] is cell A1
export interface WorkbookData { fileName: string; sheets: SheetData[] }

export interface Issue {
  severity: 'error' | 'warning'
  code: string
  file: string       // file the problem is in
  sheet: string      // sheet (or file) the problem is in
  cell: string       // e.g. 'C7' or 'B2:K31'; '' when it is about the whole sheet
  found: string      // what is currently in the cell
  problem: string
  fix: string
}

export interface Question { label: string; heading: string; col: number }
export interface Dataset {
  ids: string[]
  studentRows: number[]       // Excel row number of each student
  questions: Question[]
  answers: string[][]         // [student][question]: letter, '' (blank) or '?' (not a valid option)
  key: string[]
  nOptions: number
  keySource: string
  keyKind: 'file' | 'sheet' | 'row' | 'typed'
  textMode?: boolean          // answers were written as words; each distinct answer is an option
  optionText?: string[][]     // [question][option index] -> the text, when textMode
  optionCount?: number[]      // options per question, when textMode
}
/** The responses are fine but no answer key was found anywhere: the page asks the user for it. */
export interface NeedsKey { questions: Question[]; suggested: string[]; confidence: number[]; nOptions: number; optionText?: string[][] }
export interface CheckResult { ok: boolean; issues: Issue[]; notes: string[]; dataset?: Dataset; needsKey?: NeedsKey }

export type Level = 'good' | 'warn' | 'bad'
export interface Rating { label: string; level: Level }
