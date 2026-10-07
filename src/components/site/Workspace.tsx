import { AnimatePresence, motion } from 'motion/react'
import { ArrowDown, CheckCircle2, Circle, Loader2, Play, XCircle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Reveal } from '@/components/bits/Reveal'
import { Dropzone } from './Dropzone'
import { IssuesPanel } from './IssuesPanel'
import { KeyPanel } from './KeyPanel'
import { STEPS, type useWorkspace } from '@/hooks/useWorkspace'
import { cn } from '@/lib/utils'

type WS = ReturnType<typeof useWorkspace>

function Stepper({ step }: { step: number }) {
  return (
    <ol className="grid gap-3 sm:grid-cols-4" aria-label="Progress">
      {STEPS.map((label, i) => {
        const done = i < step
        const active = i === step
        return (
          <li key={label} className={cn('flex items-center gap-2.5 rounded-md border px-3 py-2.5 text-sm font-medium transition-colors', done && 'border-success/30 bg-success-soft', active && 'border-primary/40 bg-accent', !done && !active && 'text-muted-foreground')}>
            {done ? <CheckCircle2 className="size-4 text-success" aria-hidden="true" /> : active ? <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" /> : <Circle className="size-4" aria-hidden="true" />}
            {label}
          </li>
        )
      })}
    </ol>
  )
}

export function Workspace({ ws }: { ws: WS }) {
  const { slots, load, clear, phase, step, check, hideIds, setHideIds, run, recheck, useTypedKey, crash, setEdit, editValue, editCount } = ws
  const panel = { editValue, setEdit, editCount, onApply: recheck, nOptions: check?.dataset?.nOptions }
  const busy = phase === 'working' || slots.resp.status === 'loading' || slots.key.status === 'loading'
  const canRun = slots.resp.status === 'ready' && slots.key.status !== 'loading' && slots.key.status !== 'error' && phase !== 'working'
  const warnings = check?.issues.filter((i) => i.severity === 'warning') ?? []

  return (
    <section id="analyse" className="scroll-mt-24 py-16 md:py-24 print:hidden">
      <div className="container">
        <Reveal className="mb-10 max-w-2xl">
          <p className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-primary">Step 2</p>
          <h2 className="text-3xl font-semibold md:text-4xl">Upload and analyse</h2>
          <p className="mt-3 text-lg text-muted-foreground">Add your responses. The answer key can be a row labelled Key in the same sheet, a separate sheet or file, or you can choose it on this page.</p>
        </Reveal>
        <Reveal delay={0.05}>
          <Card>
            <CardContent className="flex flex-col gap-8 p-6 md:p-8">
              <div className="grid gap-8 md:grid-cols-2">
                <Dropzone step="2a" title="Student responses" hint="One row per student. Add a row labelled Key with the correct answers, and this is all you need." slot={slots.resp} onFile={(f) => load('resp', f)} onClear={() => clear('resp')} />
                <Dropzone step="2b" title="Answer key" optional hint="Only if your key is in a separate file." slot={slots.key} onFile={(f) => load('key', f)} onClear={() => clear('key')} />
              </div>

              <div className="flex flex-col gap-5 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex cursor-pointer items-center gap-3 text-sm font-medium">
                  <input type="checkbox" checked={hideIds} onChange={(e) => setHideIds(e.target.checked)} className="size-4 cursor-pointer rounded border-input accent-[hsl(var(--primary))]" />
                  Hide student IDs in the results (show Student 1, 2, 3 …)
                </label>
                <Button size="lg" onClick={run} disabled={!canRun} loading={phase === 'working'} className="sm:min-w-48">
                  {phase !== 'working' && <Play />}
                  {phase === 'working' ? 'Analysing' : 'Run analysis'}
                </Button>
              </div>
              {!busy && slots.resp.status !== 'ready' && <p className="-mt-4 text-sm text-muted-foreground">Add your responses file to enable the analysis.</p>}

              <AnimatePresence initial={false}>
                {phase === 'working' && (
                  <motion.div key="progress" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <Stepper step={step} />
                  </motion.div>
                )}
              </AnimatePresence>

              <div aria-live="polite" className="flex flex-col gap-6">
                {phase === 'needsKey' && check?.needsKey && <KeyPanel need={check.needsKey} onUse={useTypedKey} />}
                {phase === 'fixes' && check && <IssuesPanel issues={check.issues} blocking {...panel} />}
                {phase === 'crashed' && (
                  <Alert variant="destructive"><XCircle aria-hidden="true" /><AlertTitle>Something unexpected went wrong</AlertTitle><AlertDescription>{crash || 'Unknown error.'} Please re-save the file as a fresh .xlsx (or start from the template) and try again.</AlertDescription></Alert>
                )}
                {phase === 'done' && check && (
                  <>
                    <Alert variant="success">
                      <CheckCircle2 aria-hidden="true" />
                      <AlertTitle>Analysis complete</AlertTitle>
                      <AlertDescription>
                        <ul className="list-disc space-y-1 pl-5">{check.notes.map((n) => <li key={n}>{n}</li>)}</ul>
                        <Button asChild variant="outline" size="sm" className="mt-4"><a href="#results"><ArrowDown />Go to results</a></Button>
                      </AlertDescription>
                    </Alert>
                    {warnings.length > 0 && <IssuesPanel issues={warnings} blocking={false} {...panel} />}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </Reveal>
      </div>
    </section>
  )
}
