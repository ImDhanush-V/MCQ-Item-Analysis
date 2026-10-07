import { useState } from 'react'
import { KeyRound, Wand2 } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { LETTERS, norm } from '@/lib/text'
import type { NeedsKey } from '@/lib/types'

/** Shown when the responses are fine but no answer key exists. The user confirms or picks the key on the page. */
export function KeyPanel({ need, onUse }: { need: NeedsKey; onUse: (key: Record<string, string>) => void }) {
  const text = need.optionText
  const valueOf = (qi: number, letter: string) => (text ? text[qi]?.[letter.charCodeAt(0) - 65] ?? '' : letter)
  const [picked, setPicked] = useState<string[]>(() => need.suggested.map((L, qi) => (L ? valueOf(qi, L) : '')))
  const complete = picked.every((p) => p !== '')
  const go = (vals: string[]) => onUse(Object.fromEntries(need.questions.map((q, i) => [norm(q.heading), vals[i]])))
  return (
    <div className="flex flex-col gap-5">
      <Alert variant="warning">
        <KeyRound aria-hidden="true" />
        <AlertTitle>I could not find the answer key</AlertTitle>
        <AlertDescription>
          The responses look fine, but there is no row labelled <b>Key</b>, no Answer_Key sheet and no key file. Choose the correct option for each question below. I have filled in a <b>draft</b> from your students' answers
          (the answer the strongest third chose most often). It is only a guess, so check it against your question paper. Or add a row labelled Key to your Excel file and upload it again.
        </AlertDescription>
      </Alert>
      <div className="max-h-[520px] overflow-auto rounded-xl border">
        <Table>
          <TableHeader><TableRow><TableHead>Question</TableHead><TableHead>Correct option</TableHead><TableHead>Confidence in draft</TableHead></TableRow></TableHeader>
          <TableBody>
            {need.questions.map((q, qi) => {
              const c = need.confidence[qi]
              const opts = text ? text[qi] ?? [] : LETTERS.slice(0, need.nOptions).split('')
              return (
                <TableRow key={q.col}>
                  <TableCell className="max-w-md"><span className="font-semibold">{q.label}</span>{q.heading !== q.label && <span className="mt-0.5 block text-sm text-muted-foreground">{q.heading}</span>}</TableCell>
                  <TableCell>
                    <select aria-label={`Correct option for ${q.label}`} value={picked[qi]} onChange={(e) => setPicked((p) => p.map((v, i) => (i === qi ? e.target.value : v)))} className="h-9 w-full max-w-xs cursor-pointer rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <option value="">Choose…</option>
                      {opts.map((o, oi) => <option key={oi} value={text ? o : LETTERS[oi]}>{text ? `${LETTERS[oi]}. ${o}` : o}</option>)}
                    </select>
                  </TableCell>
                  <TableCell><Badge variant={c >= 0.8 ? 'success' : c >= 0.6 ? 'warning' : 'destructive'}>{c >= 0.8 ? 'High' : c >= 0.6 ? 'Medium' : 'Low'} ({Math.round(c * 100)}% of top students)</Badge></TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => go(picked)} disabled={!complete}><Wand2 />Analyse with this key</Button>
        {!complete && <p className="self-center text-sm text-muted-foreground">Choose an option for every question.</p>}
      </div>
    </div>
  )
}
