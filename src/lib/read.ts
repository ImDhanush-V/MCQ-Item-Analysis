// Browser-only: turns an uploaded .xlsx into plain grids. Everything after this is pure and tested.
import type { Cell } from './text.ts'
import type { WorkbookData } from './types.ts'

export class ReadError extends Error {}

export async function loadXlsx() {
  const mod: any = await import('xlsx')
  return mod.read ? mod : mod.default
}

export async function readWorkbook(file: File): Promise<WorkbookData> {
  if (!/\.xlsx$/i.test(file.name))
    throw new ReadError(`"${file.name}" is not an .xlsx file. Open it in Excel and choose File, Save As, Excel Workbook (.xlsx).`)
  if (file.size > 15 * 1024 * 1024) throw new ReadError('This file is larger than 15 MB. Remove extra sheets or images and try again.')
  const X = await loadXlsx()
  let wb: any
  try {
    wb = X.read(await file.arrayBuffer(), { type: 'array' })
  } catch {
    throw new ReadError('This file could not be opened. It may be corrupted or password-protected. Remove any password, or paste your data into the template and save a fresh copy.')
  }
  const sheets = (wb.SheetNames as string[]).map((name) => {
    const ws = wb.Sheets[name]
    const refText: string | undefined = ws?.['!ref']
    if (!refText) return { name, grid: [] as Cell[][] }
    const range = X.utils.decode_range(refText)
    const rows: Cell[][] = X.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: true, raw: true })
    // sheet_to_json starts at the top-left of the used range; pad so that grid[0][0] is always cell A1.
    const grid: Cell[][] = [
      ...Array.from({ length: range.s.r }, () => [] as Cell[]),
      ...rows.map((r) => [...Array<Cell>(range.s.c).fill(null), ...r]),
    ]
    return { name, grid }
  })
  return { fileName: file.name, sheets }
}
