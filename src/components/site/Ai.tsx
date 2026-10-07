// The optional AI helper: plain-language summary, per-question review, and letter suggestions for messy cells.
// Every AI answer is labelled, and numbers / question labels in it are verified against the calculated results first.
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Sparkles, ShieldCheck, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { site } from '@/config'
import { aiAvailable, callAi, reviewPayload, summaryPayload, verifyText, plainSummary, AiError } from '@/lib/ai'
import type { Analysis, ItemStat } from '@/lib/stats'

let probe: Promise<boolean> | null = null
export function useAiAvailable(): boolean | null {
  const [v, setV] = useState<boolean | null>(null)
  useEffect(() => { probe ??= aiAvailable(site.aiEndpoint); probe.then(setV) }, [])
  return v
}

type Run = { status: 'idle' } | { status: 'loading' } | { status: 'done'; text: string } | { status: 'failed'; message: string }

async function verified(task: 'summary' | 'review', payload: unknown, a: Analysis, only?: ItemStat): Promise<string> {
  let last: string[] = []
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await callAi(site.aiEndpoint, task, payload)
    last = verifyText(text, a, only)
    if (last.length === 0) return text
  }
  throw new AiError(`The AI wrote something that did not match your results (${last.slice(0, 2).join(', ')}), so it was thrown away.`)
}

export function AiLabel() {
  return <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground"><ShieldCheck className="size-3.5" aria-hidden="true" />AI-generated. Every number was checked against your tables; please still check them.</p>
}

export function SummaryCard({ a }: { a: Analysis }) {
  const avail = useAiAvailable()
  const [run, setRun] = useState<Run>({ status: 'idle' })
  const go = async () => {
    setRun({ status: 'loading' })
    try { setRun({ status: 'done', text: await verified('summary', summaryPayload(a), a) }) }
    catch (e) { setRun({ status: 'failed', message: e instanceof Error ? e.message : 'The AI helper failed.' }) }
  }
  const text = run.status === 'done' ? run.text : plainSummary(a)
  return (
    <Card className="rounded-2xl">
      <CardContent className="flex flex-col gap-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">In plain language</h3>
          {avail && run.status !== 'loading' && <Button variant="outline" size="sm" onClick={go}>{run.status === 'done' || run.status === 'failed' ? <RotateCcw /> : <Sparkles />}{run.status === 'idle' ? 'Reword with AI' : 'Try again'}</Button>}
          {avail === false && <span className="text-[13px] text-muted-foreground">AI helper is not switched on for this site</span>}
        </div>
        <AnimatePresence mode="wait" initial={false}>
          {run.status === 'loading' ? (
            <motion.div key="l" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-2" aria-busy="true"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-11/12" /><Skeleton className="h-4 w-4/5" /></motion.div>
          ) : (
            <motion.div key={run.status + text.length} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-3">
              {text.split('\n\n').map((p) => <p key={p} className="text-base leading-relaxed">{p}</p>)}
              {run.status === 'done' ? <AiLabel /> : <p className="text-[13px] text-muted-foreground">Written by fixed rules from your results.</p>}
            </motion.div>
          )}
        </AnimatePresence>
        {run.status === 'failed' && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive-soft px-4 py-3 text-sm">{run.message} The rule-based summary above is still correct.</p>}
      </CardContent>
    </Card>
  )
}

export function ReviewBox({ a, item }: { a: Analysis; item: ItemStat }) {
  const avail = useAiAvailable()
  const [text, setText] = useState('')
  const [ok, setOk] = useState(false)
  const [run, setRun] = useState<Run>({ status: 'idle' })
  if (avail === false) return <p className="text-sm text-muted-foreground">The AI question reviewer is not switched on for this site.</p>
  const go = async () => {
    setRun({ status: 'loading' })
    try { setRun({ status: 'done', text: await verified('review', reviewPayload(a, item, text), a, item) }) }
    catch (e) { setRun({ status: 'failed', message: e instanceof Error ? e.message : 'The AI helper failed.' }) }
  }
  return (
    <div className="flex flex-col gap-3">
      <label className="text-sm font-semibold" htmlFor={`rv-${item.index}`}>Paste the question and its options (optional but much more useful)</label>
      <textarea id={`rv-${item.index}`} value={text} onChange={(e) => setText(e.target.value)} maxLength={3000} rows={4} placeholder="Which layer of the trophoblast … A. … B. … C. … D. …" className="w-full rounded-md border border-input bg-background p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      <label className="flex cursor-pointer items-start gap-2 text-sm"><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} className="mt-0.5 size-4 cursor-pointer accent-[hsl(var(--primary))]" />I understand that this question text and this question's statistics will be sent to an AI service. No student IDs or names are sent.</label>
      <div><Button size="sm" onClick={go} disabled={!ok} loading={run.status === 'loading'}>{run.status !== 'loading' && <Sparkles />}Review this question</Button></div>
      {run.status === 'done' && <div className="flex flex-col gap-2 rounded-md border bg-muted/50 p-4"><p className="text-sm leading-relaxed">{run.text}</p><AiLabel /></div>}
      {run.status === 'failed' && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive-soft px-4 py-3 text-sm">{run.message}</p>}
    </div>
  )
}
