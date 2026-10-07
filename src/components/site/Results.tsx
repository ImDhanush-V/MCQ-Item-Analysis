import { useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, ChevronDown, Download, FileText, Printer, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CountUp } from '@/components/bits/CountUp'
import { Reveal } from '@/components/bits/Reveal'
import { SummaryCard } from './Ai'
import { QuestionsTable } from './QuestionsTable'
import { ItemAnalysisView, StudentsView, DistractorsView, RatingBadge } from './Views'
import { Report } from './Report'
import { DataNotes } from './DataNotes'
import { exportTables } from '@/lib/tables'
import { downloadXlsx } from '@/lib/export'
import { fmt } from '@/lib/format'
import type { Analysis } from '@/lib/stats'
import type { CheckResult } from '@/lib/types'

type DlState = 'idle' | 'loading' | 'done' | 'failed'

export function ResultsSkeleton() {
  return (
    <section className="py-16 print:hidden" aria-busy="true" aria-label="Preparing results">
      <div className="container flex flex-col gap-6">
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}</div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </section>
  )
}

function Kpi({ label, children, note, delay }: { label: string; children: ReactNode; note?: ReactNode; delay: number }) {
  return (
    <Reveal delay={delay} y={14}>
      <div className="flex h-full flex-col gap-1.5 rounded-2xl border bg-card p-6 shadow-sm">
        <p className="text-[12.5px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-4xl font-bold leading-tight tracking-tight">{children}</p>
        <div className="text-sm leading-snug text-muted-foreground">{note}</div>
      </div>
    </Reveal>
  )
}

export function Results({ a, hide, check }: { a: Analysis; hide: boolean; check: CheckResult | null }) {
  const [dl, setDl] = useState<DlState>('idle')
  const [detail, setDetail] = useState(false)
  const counts = { good: 0, warn: 0, bad: 0 }
  a.items.forEach((i) => counts[i.action.level]++)
  const download = async () => {
    setDl('loading')
    try { await downloadXlsx('MCQ_Item_Analysis.xlsx', exportTables(a, hide)); setDl('done') } catch { setDl('failed') }
    setTimeout(() => setDl('idle'), 2800)
  }
  const notes = (check?.issues.filter((i) => i.severity === 'warning').length ?? 0) + a.warnings.length
  return (
    <section id="results" className="scroll-mt-24 border-t bg-muted/40 py-14 md:py-20">
      <div className="container flex flex-col gap-10">
        <Reveal className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-primary">Step 3</p>
            <h2 className="text-3xl font-bold md:text-4xl">Item analysis of the questions</h2>
          </div>
          <div className="flex flex-wrap items-center gap-3 print:hidden">
            <Button variant="outline" onClick={() => window.print()}><Printer />Print or save as PDF</Button>
            <Button onClick={download} loading={dl === 'loading'} variant={dl === 'failed' ? 'outline' : 'default'} aria-live="polite">
              {dl === 'done' ? <Check /> : dl === 'failed' ? <XCircle /> : dl === 'idle' ? <Download /> : null}
              {dl === 'done' ? 'Downloaded' : dl === 'failed' ? 'Download failed, try again' : dl === 'loading' ? 'Preparing file' : 'Download Excel'}
            </Button>
          </div>
        </Reveal>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
          <Kpi delay={0} label="Students" note={`${a.g} High · ${a.nMedium} Medium · ${a.g} Low`}><CountUp to={a.n} /></Kpi>
          <Kpi delay={0.05} label="Questions" note={`max score ${a.k}`}><CountUp to={a.k} /></Kpi>
          <Kpi delay={0.1} label="Mean score" note={`median ${fmt(a.median, a.median % 1 ? 1 : 0)} · range ${a.min}–${a.max}`}><CountUp to={a.mean} decimals={2} /></Kpi>
          <Kpi delay={0.15} label="Reliability" note={<RatingBadge r={a.alphaRating} />}>{a.alphaR === null ? 'n/a' : <CountUp to={a.alphaR} decimals={2} />}</Kpi>
          <Kpi delay={0.2} label="Item quality" note={`of ${a.k} questions`}><span className="flex flex-wrap gap-2 pt-1"><Badge variant="success" className="rounded-full px-3 py-1 text-sm">{counts.good} good</Badge><Badge variant="warning" className="rounded-full px-3 py-1 text-sm">{counts.warn} review</Badge><Badge variant="destructive" className="rounded-full px-3 py-1 text-sm">{counts.bad} revise</Badge></span></Kpi>
        </div>

        <Reveal className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">Select a question number to see the full question, option shares and an AI review. Green is ideal, amber acceptable, red needs attention.</p>
          <QuestionsTable a={a} />
        </Reveal>

        <Reveal><SummaryCard a={a} /></Reveal>

        <Reveal className="print:hidden">
          <button type="button" onClick={() => setDetail((v) => !v)} aria-expanded={detail} aria-controls="detailed-report" className="flex w-full cursor-pointer items-center justify-between gap-4 rounded-2xl border bg-card p-6 text-left shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            <span className="flex items-center gap-4">
              <span className="flex size-11 items-center justify-center rounded-xl bg-accent text-primary"><FileText className="size-5" aria-hidden="true" /></span>
              <span><span className="block text-lg font-bold">Detailed report</span><span className="block text-sm text-muted-foreground">How every number was calculated, step by step, with your own data{notes ? ` · ${notes} data note${notes === 1 ? '' : 's'}` : ''}</span></span>
            </span>
            <ChevronDown className={`size-6 shrink-0 text-muted-foreground transition-transform duration-300 ${detail ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
        </Reveal>

        <AnimatePresence initial={false}>
          {detail && (
            <motion.div id="detailed-report" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }} className="-mt-4 overflow-hidden">
              <div className="rounded-2xl border bg-card p-6 shadow-sm md:p-8">
                <Tabs defaultValue="working">
                  <TabsList>
                    <TabsTrigger value="working">Step-by-step working</TabsTrigger>
                    <TabsTrigger value="items">Item analysis</TabsTrigger>
                    <TabsTrigger value="students">Students and groups</TabsTrigger>
                    <TabsTrigger value="distractors">Distractors</TabsTrigger>
                    <TabsTrigger value="notes">Data notes{notes ? ` (${notes})` : ''}</TabsTrigger>
                  </TabsList>
                  <TabsContent value="working"><Report a={a} hide={hide} /></TabsContent>
                  <TabsContent value="items"><ItemAnalysisView a={a} /></TabsContent>
                  <TabsContent value="students"><StudentsView a={a} hide={hide} /></TabsContent>
                  <TabsContent value="distractors"><DistractorsView a={a} /></TabsContent>
                  <TabsContent value="notes"><DataNotes a={a} check={check} /></TabsContent>
                </Tabs>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  )
}
