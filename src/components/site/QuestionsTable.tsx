import { Fragment, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ReviewBox } from './Ai'
import { RatingBadge, variantOf } from './Views'
import { explainItem } from '@/lib/explain'
import { fmt, signed } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Analysis } from '@/lib/stats'
import type { Level } from '@/lib/types'

const bar: Record<Level, string> = { good: 'bg-success', warn: 'bg-[hsl(38_92%_50%)]', bad: 'bg-destructive' }

function Meter({ value, level }: { value: number; level: Level }) {
  return (
    <div className="mt-1.5 h-2 w-full max-w-[9rem] overflow-hidden rounded-full bg-muted" aria-hidden="true">
      <motion.div className={cn('h-full rounded-full', bar[level])} initial={{ width: 0 }} whileInView={{ width: `${Math.max(2, Math.min(100, value))}%` }} viewport={{ once: true }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }} />
    </div>
  )
}

const th = 'px-4 py-4 text-left align-bottom text-[12.5px] font-bold uppercase leading-snug tracking-wider text-muted-foreground'
const td = 'px-4 py-5 align-top'

export function QuestionsTable({ a }: { a: Analysis }) {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
      <table className="w-full min-w-[980px] border-collapse text-[15px]">
        <thead className="border-b bg-muted/60">
          <tr>
            <th className={th}>Item</th><th className={th}>Key</th><th className={th}>Item analysis<br />% (High + Low)</th><th className={th}>Difficulty<br />index</th>
            <th className={th}>Discrimination<br />index</th><th className={th}>NFDs</th><th className={th}>Distractor<br />efficiency</th><th className={cn(th, 'min-w-[17rem]')}>Recommendation</th>
          </tr>
        </thead>
        <tbody>
          {a.items.map((i, n) => {
            const isOpen = open === i.index
            const text = a.dataset.optionText?.[i.index]
            return (
              <Fragment key={i.index}>
                <motion.tr initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '0px 0px -40px 0px' }} transition={{ duration: 0.45, delay: Math.min(n, 6) * 0.05, ease: [0.22, 1, 0.36, 1] }} className="border-b last:border-b-0">
                  <td className={td}>
                    <button type="button" onClick={() => setOpen(isOpen ? null : i.index)} aria-expanded={isOpen} aria-label={`${i.label}: show details`} className="flex cursor-pointer items-center gap-1.5 rounded-md font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      {i.label}<ChevronDown className={cn('size-4 text-muted-foreground transition-transform', isOpen && 'rotate-180')} aria-hidden="true" />
                    </button>
                  </td>
                  <td className={cn(td, 'font-medium')}>{text ? <span className="block max-w-[8rem] break-words text-sm">{text[i.key.charCodeAt(0) - 65] ?? i.key}</span> : i.key}</td>
                  <td className={cn(td, 'text-lg font-bold tabular')}>{fmt(i.hlPercentR, 1)}%</td>
                  <td className={td}><span className="tabular">{fmt(i.difR, 1)}%</span><Meter value={i.difR} level={i.difRating.level} /><div className="mt-2"><RatingBadge r={i.difRating} /></div></td>
                  <td className={td}><span className="tabular">{signed(i.diR)}</span><div className="mt-2"><RatingBadge r={i.diRating} /></div></td>
                  <td className={cn(td, 'tabular')}>{i.nfd.length}</td>
                  <td className={td}><span className="tabular">{fmt(i.deR, 0)}%</span><div className="mt-2"><RatingBadge r={i.deRating} /></div></td>
                  <td className={td}>
                    <Badge variant={variantOf(i.action.level)} className="whitespace-normal rounded-full px-3 py-1 text-sm">{i.action.text}</Badge>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{explainItem(i, text)}</p>
                  </td>
                </motion.tr>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <tr className="border-b bg-muted/30">
                      <td colSpan={8} className="p-0">
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28 }} className="overflow-hidden">
                          <div className="grid gap-6 p-6 lg:grid-cols-2">
                            <div className="flex flex-col gap-3">
                              {i.heading !== i.label && <div><p className="text-[12.5px] font-bold uppercase tracking-wider text-muted-foreground">Full question</p><p className="mt-1 text-base">{i.heading}</p></div>}
                              <div><p className="text-[12.5px] font-bold uppercase tracking-wider text-muted-foreground">Share of all {a.n} students who chose each option</p>
                                <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                                  {Object.keys(i.optionPct).map((l) => (
                                    <li key={l} className={cn('flex items-baseline justify-between gap-4 rounded-md px-3 py-1.5', l === i.key ? 'bg-success-soft font-semibold' : i.optionPct[l] < 5 ? 'bg-destructive-soft' : 'bg-background')}>
                                      <span>{l}{text?.[l.charCodeAt(0) - 65] ? `. ${text[l.charCodeAt(0) - 65]}` : ''}{l === i.key ? ' (correct)' : i.optionPct[l] < 5 ? ' (unused)' : ''}</span><span className="tabular">{fmt(i.optionPct[l], 1)}%</span>
                                    </li>
                                  ))}
                                </ul></div>
                              <p className="text-sm text-muted-foreground">High group: {i.highCorrect} of {a.g} correct. Low group: {i.lowCorrect} of {a.g} correct.</p>
                            </div>
                            <div><p className="mb-3 text-[12.5px] font-bold uppercase tracking-wider text-muted-foreground">Ask the AI about this question</p><ReviewBox a={a} item={i} /></div>
                          </div>
                        </motion.div>
                      </td>
                    </tr>
                  )}
                </AnimatePresence>
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
