import { useState } from 'react'
import { AlertTriangle, Check, ClipboardCopy, RefreshCw, XCircle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { isSingleCell } from '@/lib/check'
import type { Issue } from '@/lib/types'

const LIMIT = 40
export const issueLine = (i: Issue) => `${i.sheet}${i.cell ? '!' + i.cell : ''}${i.found ? ` (found: ${i.found})` : ''}: ${i.problem} To fix: ${i.fix}`

interface Props {
  issues: Issue[]
  blocking: boolean
  editValue: (i: Issue) => string
  setEdit: (i: Issue, v: string) => void
  editCount: number
  onApply: () => void
  nOptions?: number
}

export function IssuesPanel({ issues, blocking, editValue, setEdit, editCount, onApply }: Props) {
  const [all, setAll] = useState(false)
  const [copied, setCopied] = useState(false)
  const sorted = [...issues].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1))
  const shown = all ? sorted : sorted.slice(0, LIMIT)
  const errors = issues.filter((i) => i.severity === 'error').length
  const warnings = issues.length - errors
  const copy = async () => {
    try { await navigator.clipboard.writeText(sorted.map(issueLine).join('\n')); setCopied(true); setTimeout(() => setCopied(false), 2200) } catch { /* clipboard blocked: the table is still on screen */ }
  }
  return (
    <div className="flex flex-col gap-4">
      {blocking ? (
        <Alert variant="destructive">
          <XCircle aria-hidden="true" />
          <AlertTitle>{errors} {errors === 1 ? 'thing needs' : 'things need'} fixing before I can analyse your file</AlertTitle>
          <AlertDescription>Type the correct value in the last column for any cell shown there, then press Apply. Nothing is changed in your Excel file; the corrections only apply on this page. Other problems need a change in Excel, then upload the file again.</AlertDescription>
        </Alert>
      ) : (
        <Alert variant="warning">
          <AlertTriangle aria-hidden="true" />
          <AlertTitle>{warnings} {warnings === 1 ? 'answer to double-check' : 'answers to double-check'}</AlertTitle>
          <AlertDescription>The analysis ran. These cells may be typing mistakes. Correct them below and press Apply to recalculate; until then they count as wrong.</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{errors > 0 && `${errors} to fix`}{errors > 0 && warnings > 0 && ', '}{warnings > 0 && `${warnings} warning${warnings === 1 ? '' : 's'}`}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={copy}>{copied ? <Check /> : <ClipboardCopy />}{copied ? 'Copied' : 'Copy this list'}</Button>
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow><TableHead>Type</TableHead><TableHead>Where</TableHead><TableHead>Found</TableHead><TableHead>What is wrong</TableHead><TableHead>What to change</TableHead><TableHead>Correct it here</TableHead></TableRow>
        </TableHeader>
        <TableBody>
          {shown.map((i, n) => (
            <TableRow key={`${i.code}-${i.cell}-${n}`} className="align-top">
              <TableCell><Badge variant={i.severity === 'error' ? 'destructive' : 'warning'}>{i.severity === 'error' ? 'Fix' : 'Check'}</Badge></TableCell>
              <TableCell className="whitespace-nowrap"><span className="font-medium">{i.sheet}</span><br /><span className="font-mono font-semibold">{i.cell || 'whole sheet'}</span></TableCell>
              <TableCell className="max-w-[12rem] break-words">{i.found || 'none'}</TableCell>
              <TableCell className="min-w-[14rem]">{i.problem}</TableCell>
              <TableCell className="min-w-[14rem]">{i.fix}</TableCell>
              <TableCell className="min-w-[10rem]">
                {isSingleCell(i.cell) ? (
                  <input aria-label={`Correct value for ${i.sheet} ${i.cell}`} value={editValue(i)} onChange={(e) => setEdit(i, e.target.value)} placeholder="type here" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                ) : <span className="text-sm text-muted-foreground">Change in Excel</span>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {sorted.length > LIMIT && <Button variant="ghost" size="sm" className="self-start" onClick={() => setAll(!all)}>{all ? 'Show fewer' : `Show all ${sorted.length}`}</Button>}
      <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background/95 p-4 shadow-md backdrop-blur">
        <p className="text-sm">{editCount === 0 ? 'No corrections typed yet.' : `${editCount} correction${editCount === 1 ? '' : 's'} typed.`}</p>
        <Button onClick={onApply} disabled={editCount === 0}><RefreshCw />Apply and check again</Button>
      </div>
    </div>
  )
}

