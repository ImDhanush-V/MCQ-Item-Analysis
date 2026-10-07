import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { fmt } from '@/lib/format'
import { LETTERS } from '@/lib/text'
import { displayId } from '@/lib/tables'
import type { Analysis } from '@/lib/stats'
import type { Level, Rating } from '@/lib/types'

export const variantOf = (l: Level) => (l === 'good' ? 'success' : l === 'warn' ? 'warning' : 'destructive') as 'success' | 'warning' | 'destructive'
export const RatingBadge = ({ r }: { r: Rating }) => <Badge variant={variantOf(r.level)}>{r.label}</Badge>

function Histogram({ a }: { a: Analysis }) {
  const W = 640, H = 240, L = 40, B = 36, T = 12, R = 12
  const max = Math.max(...a.histogram, 1)
  const bw = (W - L - R) / a.histogram.length
  const x = (v: number) => L + (v / a.k) * (W - L - R - bw) + bw / 2
  const every = Math.ceil(a.histogram.length / 14)
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Bar chart of how many students achieved each total score from 0 to ${a.k}. Mean ${fmt(a.mean, 1)}.`} className="h-auto w-full">
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={T + (H - B - T) * (1 - t)} y2={T + (H - B - T) * (1 - t)} className="stroke-border" strokeWidth="1" />
            <text x={L - 8} y={T + (H - B - T) * (1 - t) + 4} textAnchor="end" className="fill-muted-foreground" fontSize="12">{Math.round(max * t)}</text>
          </g>
        ))}
        {a.histogram.map((c, i) => {
          const h = (c / max) * (H - B - T)
          return (
            <g key={i}>
              <rect x={L + i * bw + 2} y={H - B - h} width={Math.max(bw - 4, 1)} height={h} rx="2" className="fill-primary/80 transition-colors"><title>{`Score ${i}: ${c} student${c === 1 ? '' : 's'}`}</title></rect>
              {i % every === 0 && <text x={L + i * bw + bw / 2} y={H - B + 18} textAnchor="middle" className="fill-muted-foreground" fontSize="12">{i}</text>}
            </g>
          )
        })}
        <line x1={x(a.mean)} x2={x(a.mean)} y1={T} y2={H - B} className="stroke-foreground" strokeWidth="1.5" strokeDasharray="4 3" />
        <text x={Math.min(x(a.mean) + 6, W - 70)} y={T + 12} className="fill-foreground" fontSize="12" fontWeight="600">Mean {fmt(a.mean, 1)}</text>
      </svg>
      <figcaption className="mt-2 text-sm text-muted-foreground">Number of students (vertical) at each total score out of {a.k} (horizontal).</figcaption>
    </figure>
  )
}

export function ItemAnalysisView({ a }: { a: Analysis }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">Item analysis % = (High correct + Low correct) ÷ (High total + Low total) × 100. The Medium group is not used in this column. The next tab shows the working.</p>
      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Item</TableHead><TableHead>Key</TableHead><TableHead>Total students</TableHead><TableHead>Correct (all)</TableHead><TableHead>Incorrect (all)</TableHead>
            <TableHead>High total</TableHead><TableHead>High correct</TableHead><TableHead>Low total</TableHead><TableHead>Low correct</TableHead><TableHead>High + Low total</TableHead><TableHead>Item analysis %</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {a.items.map((i) => (
              <TableRow key={i.index}>
                <TableCell className="font-semibold">{i.label}</TableCell><TableCell>{i.key}</TableCell><TableCell>{a.n}</TableCell><TableCell>{i.correct}</TableCell><TableCell>{a.n - i.correct}</TableCell>
                <TableCell>{a.g}</TableCell><TableCell>{i.highCorrect}</TableCell><TableCell>{a.g}</TableCell><TableCell>{i.lowCorrect}</TableCell><TableCell>{i.hlDenominator}</TableCell><TableCell className="font-semibold">{fmt(i.hlPercentR, 1)}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

export function StudentsView({ a, hide }: { a: Analysis; hide: boolean }) {
  const rows = [...a.students].sort((x, y) => a.order.indexOf(x.index) - a.order.indexOf(y.index))
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Card><CardHeader><CardTitle>Score distribution</CardTitle></CardHeader><CardContent><Histogram a={a} /></CardContent></Card>
        <Card><CardHeader><CardTitle>Groups</CardTitle><CardDescription>High and Low each hold ⌊n ÷ 3⌋ students. Whatever is left over goes to Medium.</CardDescription></CardHeader>
          <CardContent><dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-muted-foreground">High</dt><dd className="font-semibold">{a.g} students (scores {a.cutoff.highScore} and above)</dd>
            <dt className="text-muted-foreground">Medium</dt><dd className="font-semibold">{a.nMedium} students</dd>
            <dt className="text-muted-foreground">Low</dt><dd className="font-semibold">{a.g} students (scores {a.cutoff.lowScore} and below)</dd>
          </dl></CardContent></Card>
      </div>
      <p className="text-sm text-muted-foreground">Students ranked by total score. Equal scores share a rank and keep the order of your file.</p>
      <div className="max-h-[560px] overflow-auto rounded-lg">
        <Table>
          <TableHeader><TableRow><TableHead>Rank</TableHead><TableHead>Student</TableHead><TableHead>Score</TableHead><TableHead>Percent</TableHead><TableHead>Group</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((s) => (
              <TableRow key={s.index}>
                <TableCell>{s.rank}</TableCell><TableCell className="font-medium">{displayId(a, s.index, hide)}</TableCell><TableCell>{s.total} / {a.k}</TableCell><TableCell>{fmt(s.percent, 1)}%</TableCell>
                <TableCell><Badge variant={s.group === 'High' ? 'success' : s.group === 'Low' ? 'destructive' : 'secondary'}>{s.group}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

export function DistractorsView({ a }: { a: Analysis }) {
  const letters = LETTERS.slice(0, a.nOptions).split('')
  const text = a.dataset.optionText
  return (
    <div className="flex flex-col gap-4">
      {text && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">Your students' answers were words, so each different answer was treated as one option, lettered in the order it first appears. This is the list:</p>
          <div className="max-h-72 overflow-auto rounded-xl border">
            <Table><TableHeader><TableRow><TableHead>Question</TableHead>{letters.map((l) => <TableHead key={l}>Option {l}</TableHead>)}</TableRow></TableHeader>
              <TableBody>{a.items.map((i) => (<TableRow key={i.index}><TableCell className="font-semibold">{i.label}</TableCell>{letters.map((l, k) => <TableCell key={l} className={cn('min-w-[10rem] max-w-xs break-words', l === i.key && 'bg-success-soft font-semibold')}>{text[i.index]?.[k] ?? ''}</TableCell>)}</TableRow>))}</TableBody></Table>
          </div>
        </div>
      )}
      <div className="text-sm text-muted-foreground">Percentage of all students who chose each option. <Badge variant="success">Green</Badge> is the correct answer. <Badge variant="destructive">Red</Badge> is a wrong option chosen by fewer than 5% (non-functional).</div>
      <Table>
        <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Key</TableHead>{letters.map((l) => <TableHead key={l}>{l}</TableHead>)}<TableHead>Blank</TableHead><TableHead>Invalid</TableHead></TableRow></TableHeader>
        <TableBody>
          {a.items.map((i) => (
            <TableRow key={i.index}>
              <TableCell className="font-semibold">{i.label}</TableCell><TableCell>{i.key}</TableCell>
              {letters.map((l) => (
                i.optionPct[l] === undefined ? <TableCell key={l} className="text-muted-foreground">–</TableCell> : <TableCell key={l} className={cn(l === i.key ? 'bg-success-soft font-semibold' : i.optionPct[l] < 5 && 'bg-destructive-soft')}>{fmt(i.optionPct[l], 1)}%</TableCell>
              ))}
              <TableCell>{fmt((i.blank / a.n) * 100, 1)}%</TableCell><TableCell>{fmt((i.invalid / a.n) * 100, 1)}%</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
