import { AlertTriangle, Info } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { issueLine } from './IssuesPanel'
import type { Analysis } from '@/lib/stats'
import type { CheckResult } from '@/lib/types'

/** Everything that is "good to know" but not part of the answer: how the file was read, warnings, and a self-check of the arithmetic. */
export function DataNotes({ a, check }: { a: Analysis; check: CheckResult | null }) {
  const warnings = check?.issues.filter((i) => i.severity === 'warning') ?? []
  const sumCorrect = a.items.reduce((s, i) => s + i.correct, 0)
  const sumTotals = a.totals.reduce((s, t) => s + t, 0)
  const checks: [string, boolean][] = [
    [`High (${a.g}) + Medium (${a.nMedium}) + Low (${a.g}) = ${a.g + a.nMedium + a.g} = ${a.n} students`, a.g + a.nMedium + a.g === a.n],
    [`Sum of correct answers over all questions (${sumCorrect}) = sum of all total scores (${sumTotals})`, sumCorrect === sumTotals],
    ['Every question\'s option percentages add up to 100% (including blank and invalid answers)', a.items.every((i) => Math.abs(Object.values(i.optionPct).reduce((s, v) => s + v, 0) + ((i.blank + i.invalid) / a.n) * 100 - 100) < 1e-9)],
    ['Each item analysis % lies between 0 and 100', a.items.every((i) => i.hlPercent >= 0 && i.hlPercent <= 100)],
  ]
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h3 className="text-lg font-semibold">How your file was read</h3>
        <ul className="list-disc space-y-1.5 pl-6 text-base">{check?.notes.map((n) => <li key={n}>{n}</li>)}</ul>
      </div>
      <div className="flex flex-col gap-3">
        <h3 className="text-lg font-semibold">Things to double-check</h3>
        {a.warnings.length + warnings.length === 0 ? <p className="text-base text-muted-foreground">Nothing to double-check.</p> : (
          <>
            {a.warnings.map((w) => <Alert key={w} variant="warning"><AlertTriangle aria-hidden="true" /><AlertDescription>{w}</AlertDescription></Alert>)}
            {warnings.map((w, i) => <Alert key={i} variant="warning"><AlertTriangle aria-hidden="true" /><AlertDescription>{issueLine(w)}</AlertDescription></Alert>)}
          </>
        )}
      </div>
      <div className="flex flex-col gap-3">
        <h3 className="text-lg font-semibold">Self-check of the arithmetic</h3>
        <ul className="flex flex-col gap-2">{checks.map(([t, ok]) => <li key={t}><Alert variant={ok ? 'success' : 'destructive'}><Info aria-hidden="true" /><AlertDescription>{ok ? 'Passed: ' : 'Failed: '}{t}</AlertDescription></Alert></li>)}</ul>
      </div>
    </div>
  )
}
