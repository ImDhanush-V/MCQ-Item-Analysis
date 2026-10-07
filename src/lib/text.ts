// Text and cell helpers. Pure functions, no DOM.
export type Cell = string | number | boolean | Date | null | undefined
export type Grid = Cell[][]

const BLANK_TOKENS = new Set(['', 'nan', 'none', 'null', 'n/a', 'na', 'nil', '-', '--'])

/** Comparison form of a cell: trimmed, single-spaced, lower-case, quotes unified. Blank-like values become ''. */
export function norm(x: Cell): string {
  if (x === null || x === undefined) return ''
  let s: string
  if (typeof x === 'number') {
    if (!Number.isFinite(x)) return ''
    s = Number.isInteger(x) ? String(x) : String(x)
  } else if (x instanceof Date) s = x.toISOString()
  else s = String(x)
  s = s
    .normalize('NFKC')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
  return BLANK_TOKENS.has(s) ? '' : s
}

/** Display form of a cell: trimmed text exactly as typed (numbers without trailing .0). */
export function show(x: Cell): string {
  if (x === null || x === undefined) return ''
  if (x instanceof Date) return x.toISOString().slice(0, 10)
  return String(x).replace(/\s+/g, ' ').trim()
}

const LETTER_RE = /^(?:option|opt|choice|ans(?:wer)?)?\s*[(\[]?\s*([a-h])\s*[)\]]?\s*[.:]?\s*$/
const MULTI_RE = /^[a-h](\s*(,|;|\/|&|\band\b|\s)\s*[a-h])+$/

export const LETTERS = 'ABCDEFGH'

/** 'b', '(B)', 'Option B', 'B.' -> 'B'.  Anything else -> null. Input must already be norm()-ed. */
export function asLetter(s: string): string | null {
  const m = LETTER_RE.exec(s)
  return m ? m[1].toUpperCase() : null
}
export function isMulti(s: string): boolean {
  return MULTI_RE.test(s)
}

export function colLetter(i: number): string {
  let s = ''
  let n = i + 1
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}
/** Excel-style reference for zero-based row and column, e.g. (6, 2) -> 'C7'. */
export function ref(row: number, col: number): string {
  return `${colLetter(col)}${row + 1}`
}

/** 'Q3', '3', '3.', 'Question 3' -> 3. Otherwise null. Input must be norm()-ed. */
export function itemNumber(s: string): number | null {
  const m = /^(?:q(?:uestion|n)?\.?\s*|item\s*|no\.?\s*|#\s*)?(\d+)\s*[.)]?$/.exec(s)
  return m ? Number(m[1]) : null
}

export function sheetKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** Levenshtein distance, used only to suggest "did you mean ...". */
export function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)] as number[])
  for (let j = 1; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return dp[a.length][b.length]
}
export function closest(name: string, options: string[]): string | null {
  const n = norm(name)
  let best: string | null = null
  let bestD = Infinity
  for (const o of options) {
    const d = editDistance(n, norm(o))
    if (d < bestD) { bestD = d; best = o }
  }
  return best !== null && bestD <= Math.max(2, Math.floor(n.length * 0.25)) ? best : null
}

export function list(xs: string[], n = 6): string {
  return xs.slice(0, n).join(', ') + (xs.length > n ? ` … (+${xs.length - n} more)` : '')
}
