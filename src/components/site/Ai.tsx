// The optional AI helper: plain-language summary, per-question review, action plan, reliability coaching,
// distractor explanation, issue explainer, and what-if drop prediction.
// Every AI answer is labelled, and numbers / question labels in it are verified against calculated results first.
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Sparkles, ShieldCheck, RotateCcw, ListChecks, TrendingUp, FileWarning, HelpCircle, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { site } from '@/config'
import {
  aiAvailable, callAi, reviewPayload, summaryPayload, verifyText, plainSummary, AiError,
  planPayload, alphaPayload, issuesPayload, distractorPayload, dropPayload, alphaIfDropped,
} from '@/lib/ai'
import type { Analysis, ItemStat } from '@/lib/stats'
import type { Issue } from '@/lib/types'
import { fmt } from '@/lib/format'

let probe: Promise<boolean> | null = null
export function useAiAvailable(): boolean | null {
  const [v, setV] = useState<boolean | null>(null)
  useEffect(() => { probe ??= aiAvailable(site.aiEndpoint); probe.then(setV) }, [])
  return v
}

type Run = { status: 'idle' } | { status: 'loading' } | { status: 'done'; text: string } | { status: 'failed'; message: string }

async function verified(task: 'summary' | 'review' | 'plan' | 'alpha' | 'issues' | 'distractor' | 'drop', payload: unknown, a: Analysis, only?: ItemStat): Promise<string> {
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

// ── AiBlock: shared shell for every AI card ───────────────────────────────────
function AiBlock({ run, fallback, onGo, onRetry, buttonLabel, icon, title }: {
  run: Run; fallback?: string; onGo: () => void; onRetry?: () => void;
  buttonLabel: string; icon: React.ReactNode; title: string
}) {
  const avail = useAiAvailable()
  const showFallback = run.status === 'idle' || run.status === 'failed'
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-[12.5px] font-bold uppercase tracking-wider text-muted-foreground">{icon}{title}</p>
        {avail && run.status !== 'loading' && (
          <Button variant="outline" size="sm" onClick={run.status === 'failed' ? (onRetry ?? onGo) : onGo}>
            {run.status === 'done' || run.status === 'failed' ? <RotateCcw /> : <Sparkles />}
            {run.status === 'idle' ? buttonLabel : 'Try again'}
          </Button>
        )}
        {avail === false && <span className="text-[13px] text-muted-foreground">AI helper is not switched on for this site.</span>}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        {run.status === 'loading' ? (
          <motion.div key="l" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-2" aria-busy="true">
            <Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-11/12" /><Skeleton className="h-4 w-4/5" />
          </motion.div>
        ) : run.status === 'done' ? (
          <motion.div key="done" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-3">
            {run.text.split('\n\n').map((p) => <p key={p} className="text-base leading-relaxed">{p}</p>)}
            <AiLabel />
          </motion.div>
        ) : showFallback && fallback ? (
          <motion.div key="fallback" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-3">
            {fallback.split('\n\n').map((p) => <p key={p} className="text-base leading-relaxed">{p}</p>)}
            <p className="text-[13px] text-muted-foreground">Written by fixed rules from your results.</p>
          </motion.div>
        ) : null}
      </AnimatePresence>
      {run.status === 'failed' && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive-soft px-4 py-3 text-sm">
          {run.message} {fallback ? 'The rule-based summary above is still correct.' : ''}
        </p>
      )}
    </div>
  )
}

// ── 1. Summary card (existing) ────────────────────────────────────────────────
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

// ── 2. Action plan card (NEW) ─────────────────────────────────────────────────
export function ActionPlanCard({ a }: { a: Analysis }) {
  const [run, setRun] = useState<Run>({ status: 'idle' })
  const go = async () => {
    setRun({ status: 'loading' })
    try { setRun({ status: 'done', text: await verified('plan', planPayload(a), a) }) }
    catch (e) { setRun({ status: 'failed', message: e instanceof Error ? e.message : 'The AI helper failed.' }) }
  }
  const avail = useAiAvailable()
  if (avail === false) return null
  return (
    <Card className="rounded-2xl border-primary/20 bg-primary/5">
      <CardContent className="flex flex-col gap-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-lg font-semibold"><ListChecks className="size-5 text-primary" aria-hidden="true" />AI action plan</h3>
          {avail && run.status !== 'loading' && (
            <Button variant="outline" size="sm" onClick={go}>
              {run.status === 'done' || run.status === 'failed' ? <RotateCcw /> : <Sparkles />}
              {run.status === 'idle' ? 'Generate action plan' : 'Regenerate'}
            </Button>
          )}
        </div>
        <AnimatePresence mode="wait" initial={false}>
          {run.status === 'idle' && (
            <p className="text-sm text-muted-foreground">Click the button for a prioritised to-do list telling you exactly what to do with each flagged question.</p>
          )}
          {run.status === 'loading' && (
            <motion.div key="l" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-2" aria-busy="true">
              <Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-11/12" /><Skeleton className="h-4 w-4/5" /><Skeleton className="h-4 w-10/12" /><Skeleton className="h-4 w-9/12" />
            </motion.div>
          )}
          {run.status === 'done' && (
            <motion.div key="done" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-3">
              {run.text.split('\n\n').map((p) => <p key={p} className="text-base leading-relaxed">{p}</p>)}
              <AiLabel />
            </motion.div>
          )}
        </AnimatePresence>
        {run.status === 'failed' && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive-soft px-4 py-3 text-sm">{run.message}</p>}
      </CardContent>
    </Card>
  )
}

// ── 3. Reliability coaching (NEW) ─────────────────────────────────────────────
export function AlphaCoachButton({ a }: { a: Analysis }) {
  const avail = useAiAvailable()
  const [run, setRun] = useState<Run>({ status: 'idle' })
  if (!avail) return null
  if (a.alpha !== null && a.alpha >= 0.7) return null   // only show when alpha is borderline or low
  const go = async () => {
    setRun({ status: 'loading' })
    try { setRun({ status: 'done', text: await callAi(site.aiEndpoint, 'alpha', alphaPayload(a)) }) }
    catch (e) { setRun({ status: 'failed', message: e instanceof Error ? e.message : 'The AI helper failed.' }) }
  }
  return (
    <AnimatePresence initial={false}>
      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
        <div className="mt-3 flex flex-col gap-2 rounded-xl border border-warning/30 bg-warning-soft p-4 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 font-semibold text-foreground"><TrendingUp className="size-4 text-warning-foreground" aria-hidden="true" />How to improve reliability?</span>
            {run.status !== 'loading' && (
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={go}>
                {run.status === 'done' || run.status === 'failed' ? <RotateCcw className="size-3" /> : <Sparkles className="size-3" />}
                {run.status === 'idle' ? 'Ask AI' : 'Retry'}
              </Button>
            )}
          </div>
          {run.status === 'loading' && <div className="flex flex-col gap-1.5"><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-11/12" /><Skeleton className="h-3 w-4/5" /></div>}
          {run.status === 'done' && <><p className="leading-relaxed text-foreground">{run.text}</p><AiLabel /></>}
          {run.status === 'failed' && <p role="alert" className="text-destructive">{run.message}</p>}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

// ── 4. Per-question review (existing) ─────────────────────────────────────────
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

// ── 5. Distractor explanation (NEW) ──────────────────────────────────────────
export function DistractorExplainBox({ a, item }: { a: Analysis; item: ItemStat }) {
  const avail = useAiAvailable()
  const [text, setText] = useState('')
  const [run, setRun] = useState<Run>({ status: 'idle' })
  if (avail === false || item.nfd.length === 0) return null
  const go = async () => {
    setRun({ status: 'loading' })
    try { setRun({ status: 'done', text: await callAi(site.aiEndpoint, 'distractor', distractorPayload(a, item, text)) }) }
    catch (e) { setRun({ status: 'failed', message: e instanceof Error ? e.message : 'The AI helper failed.' }) }
  }
  return (
    <div className="flex flex-col gap-3 border-t pt-3">
      <p className="flex items-center gap-1.5 text-[12.5px] font-bold uppercase tracking-wider text-muted-foreground">
        <HelpCircle className="size-3.5" aria-hidden="true" />Why are options {item.nfd.join(', ')} unused?
      </p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={3000} rows={3} placeholder="Paste the question text for a more precise explanation (optional)" className="w-full rounded-md border border-input bg-background p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      {run.status !== 'loading' && (
        <div><Button size="sm" variant="outline" onClick={go}>{run.status === 'done' || run.status === 'failed' ? <RotateCcw /> : <Sparkles />}{run.status === 'idle' ? 'Explain unused distractors' : 'Try again'}</Button></div>
      )}
      {run.status === 'loading' && <div className="flex flex-col gap-1.5"><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-11/12" /><Skeleton className="h-3 w-4/5" /></div>}
      {run.status === 'done' && <div className="flex flex-col gap-2 rounded-md border bg-muted/50 p-4"><p className="text-sm leading-relaxed">{run.text}</p><AiLabel /></div>}
      {run.status === 'failed' && <p role="alert" className="text-sm text-destructive">{run.message}</p>}
    </div>
  )
}

// ── 6. What-if drop prediction (NEW) ─────────────────────────────────────────
export function WhatIfDropButton({ a, item }: { a: Analysis; item: ItemStat }) {
  const avail = useAiAvailable()
  const [run, setRun] = useState<Run>({ status: 'idle' })
  if (!avail || item.action.level !== 'bad') return null
  const dropped = alphaIfDropped(a, item)
  const go = async () => {
    setRun({ status: 'loading' })
    try { setRun({ status: 'done', text: await callAi(site.aiEndpoint, 'drop', dropPayload(a, item)) }) }
    catch (e) { setRun({ status: 'failed', message: e instanceof Error ? e.message : 'The AI helper failed.' }) }
  }
  return (
    <div className="flex flex-col gap-2 border-t pt-3">
      <p className="flex items-center gap-1.5 text-[12.5px] font-bold uppercase tracking-wider text-muted-foreground">
        <Trash2 className="size-3.5" aria-hidden="true" />What if I drop this question?
      </p>
      {dropped !== null && a.alphaR !== null && (
        <p className="text-sm text-muted-foreground">
          Alpha would change from <strong>{fmt(a.alphaR, 2)}</strong> → <strong>{fmt(dropped, 2)}</strong> ({dropped > a.alphaR ? '↑' : dropped < a.alphaR ? '↓' : '='} {fmt(Math.abs(dropped - a.alphaR), 2)}).
        </p>
      )}
      {dropped === null && <p className="text-sm text-muted-foreground">Alpha if dropped cannot be calculated (fewer than 2 items remaining or no variance).</p>}
      {run.status !== 'loading' && (
        <div><Button size="sm" variant="outline" onClick={go}>{run.status === 'done' || run.status === 'failed' ? <RotateCcw /> : <Sparkles />}{run.status === 'idle' ? 'Ask AI about dropping it' : 'Try again'}</Button></div>
      )}
      {run.status === 'loading' && <div className="flex flex-col gap-1.5"><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-11/12" /></div>}
      {run.status === 'done' && <div className="flex flex-col gap-2 rounded-md border bg-muted/50 p-4"><p className="text-sm leading-relaxed">{run.text}</p><AiLabel /></div>}
      {run.status === 'failed' && <p role="alert" className="text-sm text-destructive">{run.message}</p>}
    </div>
  )
}

// ── 7. Excel issues explainer (NEW) ──────────────────────────────────────────
export function IssueExplainerButton({ a, issues }: { a: Analysis; issues: Issue[] }) {
  const avail = useAiAvailable()
  const [run, setRun] = useState<Run>({ status: 'idle' })
  if (!avail || issues.length === 0) return null
  const go = async () => {
    setRun({ status: 'loading' })
    try {
      const payload = issuesPayload(issues.map((i) => ({ severity: i.severity, sheet: i.sheet, cell: i.cell, found: i.found, problem: i.problem, fix: i.fix })))
      setRun({ status: 'done', text: await callAi(site.aiEndpoint, 'issues', payload) })
    } catch (e) { setRun({ status: 'failed', message: e instanceof Error ? e.message : 'The AI helper failed.' }) }
  }
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold"><FileWarning className="size-4 text-primary" aria-hidden="true" />Explain these {issues.length} issue{issues.length === 1 ? '' : 's'} in plain language</p>
        {run.status !== 'loading' && (
          <Button size="sm" variant="outline" onClick={go}>
            {run.status === 'done' || run.status === 'failed' ? <RotateCcw /> : <Sparkles />}
            {run.status === 'idle' ? 'Explain with AI' : 'Try again'}
          </Button>
        )}
      </div>
      {run.status === 'loading' && <div className="flex flex-col gap-1.5"><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-11/12" /><Skeleton className="h-3 w-4/5" /></div>}
      {run.status === 'done' && <div className="flex flex-col gap-2"><p className="text-sm leading-relaxed">{run.text}</p><AiLabel /></div>}
      {run.status === 'failed' && <p role="alert" className="text-sm text-destructive">{run.message}</p>}
    </div>
  )
}
