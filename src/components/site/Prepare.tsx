import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Reveal } from '@/components/bits/Reveal'
import { site } from '@/config'

const rules = [
  'Save the file as .xlsx.',
  'Headings go on row 1. No title rows above them.',
  'Use anonymous IDs. Never student names.',
  'Answers can be letters (A, B, C, D), numbers (1 to 4) or the option text itself. Leave a cell empty if unanswered.',
  'The simplest way to give the answer key is one row labelled Key in column A, written in the same style as the answers.',
  'Any other layout is fine too. If something cannot be read, the page shows the exact cell and lets you correct it there.',
]

const ways = [
  ['A row labelled Key', 'In the Responses sheet, at the top or bottom. Recommended.'],
  ['A separate sheet', 'Named Answer_Key: Question in column A, Answer in column B. Or the questions across a row with the answers below.'],
  ['A separate file', 'Upload it in step 2 as the answer key.'],
  ['No key at all', 'The page asks you to choose it, with a draft worked out from the answers for you to confirm.'],
]

export function Prepare() {
  return (
    <section id="prepare" className="scroll-mt-24 border-b bg-muted/60 py-16 md:py-24 print:hidden">
      <div className="container">
        <Reveal className="mb-10 max-w-2xl">
          <p className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-primary">Step 1</p>
          <h2 className="text-3xl font-semibold md:text-4xl">Prepare your Excel file</h2>
          <p className="mt-3 text-lg text-muted-foreground">One sheet is enough: the students' answers and a Key row. The quickest way is to download the template and paste your data into it.</p>
        </Reveal>
        <div className="grid gap-6 md:grid-cols-2">
          <Reveal><Card className="h-full rounded-2xl">
            <CardHeader><CardTitle>Sheet "Responses"</CardTitle><CardDescription>One row per student, one column per question, and one row labelled Key.</CardDescription></CardHeader>
            <CardContent>
              <Table><TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Q1</TableHead><TableHead>Q2</TableHead><TableHead>Q3</TableHead></TableRow></TableHeader>
                <TableBody>
                  <TableRow className="bg-accent font-semibold"><TableCell>Key</TableCell><TableCell>B</TableCell><TableCell>C</TableCell><TableCell>A</TableCell></TableRow>
                  <TableRow><TableCell>S001</TableCell><TableCell>B</TableCell><TableCell>C</TableCell><TableCell>A</TableCell></TableRow>
                  <TableRow><TableCell>S002</TableCell><TableCell>B</TableCell><TableCell>D</TableCell><TableCell className="text-muted-foreground">(empty)</TableCell></TableRow>
                  <TableRow><TableCell>S003</TableCell><TableCell>A</TableCell><TableCell>C</TableCell><TableCell>A</TableCell></TableRow>
                </TableBody></Table>
            </CardContent>
          </Card></Reveal>
          <Reveal delay={0.08}><Card className="h-full rounded-2xl">
            <CardHeader><CardTitle>Where the answer key can be</CardTitle><CardDescription>Use whichever is easiest. The page works out which one you used.</CardDescription></CardHeader>
            <CardContent>
              <ul className="divide-y">{ways.map(([t, d]) => <li key={t} className="py-3 first:pt-0 last:pb-0"><p className="font-semibold">{t}</p><p className="text-sm text-muted-foreground">{d}</p></li>)}</ul>
            </CardContent>
          </Card></Reveal>
        </div>
        <Reveal delay={0.1} className="mt-10 grid gap-8 md:grid-cols-[1.4fr_1fr] md:items-start">
          <div>
            <h3 className="text-lg font-semibold">Rules</h3>
            <ol className="mt-4 list-decimal space-y-2.5 pl-5 text-base marker:font-semibold marker:text-primary">{rules.map((r) => <li key={r} className="pl-1">{r}</li>)}</ol>
          </div>
          <Card><CardContent className="flex flex-col gap-4 p-6">
            <p className="text-base font-semibold">Start from the template</p>
            <p className="text-sm text-muted-foreground">It has the Responses sheet with a Key row, and made-up example data you can analyse straight away.</p>
            <Button asChild><a href={site.templateUrl} download><Download />Download template</a></Button>
          </CardContent></Card>
        </Reveal>
      </div>
    </section>
  )
}
