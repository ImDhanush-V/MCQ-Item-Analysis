import type { SheetTable } from './tables.ts'
import { loadXlsx } from './read.ts'

export async function downloadXlsx(fileName: string, tables: SheetTable[]) {
  const X = await loadXlsx()
  const wb = X.utils.book_new()
  for (const t of tables) X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(t.rows), t.name.slice(0, 31))
  const data = X.write(wb, { bookType: 'xlsx', type: 'array' })
  const url = URL.createObjectURL(new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
