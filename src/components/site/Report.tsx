// The detailed report: every calculation, in order, with the actual numbers substituted.
import type { ReactNode } from 'react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { RatingBadge, variantOf } from './Views'
import { fmt, signed } from '@/lib/format'
import { displayId } from '@/lib/tables'
import { LETTERS } from '@/lib/text'
import { NFD_CUTOFF_PCT, type Analysis } from '@/lib/stats'

const f4 = (x: number) => fmt(x, 4)

function Section({ id, num, title, children }: { id: string; num: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-t pt-10 first:border-t-0 first:pt-0">
      <h3 className="mb-5 text-2xl font-semibold">{num && <span className="mr-3 text-primary">{num}</span>}{title}</h3>
      <div className="flex flex-col gap-5 text-base leading-relaxed">{children}</div>
    </section>
  )
}
const Formula = ({ children }: { children: ReactNode }) => <div className="overflow-x-auto rounded-md border bg-muted/70 px-5 py-4 font-mono text-[15px] leading-relaxed">{children}</div>
const Work = ({ children }: { children: ReactNode }) => <div className="overflow-x-auto rounded-md border border-primary/20 bg-accent/60 px-5 py-4 font-mono text-[15px] leading-loose">{children}</div>
const Note = ({ children }: { children: ReactNode }) => <p className="text-sm text-muted-foreground">{children}</p>
const Mono = ({ children }: { children: ReactNode }) => <span className="whitespace-nowrap font-mono text-[14px]">{children}</span>

export const REPORT_SECTIONS = [
  ['r-about', 'About this report'], ['r-data', '1. Data used'], ['r-score', '2. Scoring'], ['r-totals', '3. Total scores'], ['r-groups', '4. High, Medium, Low'], ['r-ia', '5. Item analysis %'],
  ['r-dif', '6. Difficulty index'], ['r-di', '7. Discrimination index'], ['r-de', '8. Distractor analysis'], ['r-alpha', '9. Reliability'], ['r-rules', '10. Decisions'], ['r-each', '11. One question at a time'], ['r-limits', '12. Assumptions'],
] as const

export function Report({ a, hide }: { a: Analysis; hide: boolean }) {
  const ds = a.dataset
  const letters = LETTERS.slice(0, a.nOptions).split('')
  const sumTotals = a.totals.reduce((x, y) => x + y, 0)
  const ss = a.variance * (a.n - 1)
  const first = 0
  const id = (i: number) => displayId(a, i, hide)
  const order = a.order
  const rankRow = (i: number) => ({ pos: order.indexOf(i) + 1, id: id(i), total: a.totals[i] })
  const ratio = a.alpha === null ? 0 : a.sumItemVar / a.variance

  return (
    <div className="grid gap-10 lg:grid-cols-[220px_1fr]">
      <nav aria-label="Report sections" className="hidden lg:block print:hidden">
        <ul className="sticky top-24 flex flex-col gap-1 border-l text-sm">
          {REPORT_SECTIONS.map(([sid, label]) => (
            <li key={sid}><a href={`#${sid}`} className="-ml-px block border-l-2 border-transparent py-1.5 pl-4 text-muted-foreground transition-colors">{label}</a></li>
          ))}
        </ul>
      </nav>

      <article className="flex min-w-0 flex-col gap-12">
        <Section id="r-about" num="" title="About this report">
          <p>This report shows how every number in the results was calculated, in the order the calculations are done. Each step gives the formula, then the same formula with your numbers filled in. Figures are shown rounded; the calculations themselves use the unrounded values.</p>
          <Table>
            <TableHeader><TableRow><TableHead>Symbol</TableHead><TableHead>Meaning</TableHead><TableHead>Value here</TableHead></TableRow></TableHeader>
            <TableBody>
              {[
                ['n', 'number of students', a.n], ['k', 'number of questions', a.k], ['c', 'students who answered a question correctly', 'per question'], ['p', 'proportion correct = c / n', 'per question'],
                ['g', 'students in each of the High and Low groups: n ÷ 3, rounded down', a.g], ['Medium', 'the students left over: n − 2g', a.nMedium], ['H, L', 'correct answers to a question in the High and Low group', 'per question'],
                ['t', "a student's total score", 'per student'], ['x̄, s², s', 'mean, variance and standard deviation of the total scores', `${fmt(a.mean, 2)}, ${fmt(a.variance, 2)}, ${fmt(a.sd, 2)}`],
              ].map(([s, m, v]) => (<TableRow key={String(s)}><TableCell className="font-mono font-semibold">{s}</TableCell><TableCell>{m}</TableCell><TableCell>{v}</TableCell></TableRow>))}
            </TableBody>
          </Table>
        </Section>

        <Section id="r-data" num="1" title="Data used">
          <p>{a.n} students and {a.k} questions were read. Each question is assumed to have {a.nOptions} options ({letters[0]} to {letters[letters.length - 1]}) with exactly one correct answer. The answer key came from {ds.keySource}.</p>
          <Table>
            <TableHeader><TableRow><TableHead>Question</TableHead><TableHead>Correct answer</TableHead><TableHead>Heading in your file</TableHead></TableRow></TableHeader>
            <TableBody>{a.items.map((i) => (<TableRow key={i.index}><TableCell className="font-semibold">{i.label}</TableCell><TableCell>{i.key}</TableCell><TableCell className="max-w-md break-words">{i.heading}</TableCell></TableRow>))}</TableBody>
          </Table>
        </Section>

        <Section id="r-score" num="2" title="Scoring each answer">
          <Formula>score = 1 if the student's answer = the correct answer, otherwise 0</Formula>
          <Note>A blank answer, or an answer that is not a valid option letter, scores 0. It is never counted as correct.</Note>
          <p>Worked example for the first student in your file, <b>{id(first)}</b>:</p>
          <Table>
            <TableHeader><TableRow><TableHead>Question</TableHead><TableHead>Student answered</TableHead><TableHead>Correct answer</TableHead><TableHead>Score</TableHead></TableRow></TableHeader>
            <TableBody>
              {a.items.map((i) => { const ans = ds.answers[first][i.index]; return (
                <TableRow key={i.index}><TableCell className="font-semibold">{i.label}</TableCell><TableCell>{ans === '' ? '(blank)' : ans === '?' ? '(not a valid option)' : ans}</TableCell><TableCell>{i.key}</TableCell><TableCell className="font-semibold">{a.scores[first][i.index]}</TableCell></TableRow>) })}
            </TableBody>
          </Table>
          <Accordion type="single" collapsible className="rounded-lg border px-5 print:hidden">
            <AccordionItem value="matrix"><AccordionTrigger>Show the full scoring table (every student, every question)</AccordionTrigger>
              <AccordionContent>
                <div className="max-h-[480px] overflow-auto rounded-md border">
                  <Table>
                    <TableHeader><TableRow><TableHead>Student</TableHead>{a.items.map((i) => <TableHead key={i.index}>{i.label}</TableHead>)}<TableHead>Total</TableHead></TableRow></TableHeader>
                    <TableBody>{a.scores.map((row, s) => (<TableRow key={s}><TableCell className="font-medium">{id(s)}</TableCell>{row.map((v, j) => <TableCell key={j} className={v ? '' : 'bg-destructive-soft'}>{v}</TableCell>)}<TableCell className="font-semibold">{a.totals[s]}</TableCell></TableRow>))}</TableBody>
                  </Table>
                </div>
              </AccordionContent></AccordionItem>
          </Accordion>
        </Section>

        <Section id="r-totals" num="3" title="Total scores and summary statistics">
          <Formula>t = sum of the question scores for one student</Formula>
          <p>Mean of the total scores:</p>
          <Formula>x̄ = Σt / n</Formula>
          <Work>x̄ = {sumTotals} / {a.n} = <b>{fmt(a.mean, 4)}</b></Work>
          <p>Variance and standard deviation (sample, dividing by n − 1):</p>
          <Formula>s² = Σ(t − x̄)² / (n − 1){'   '}s = √s²</Formula>
          <Work>Σ(t − x̄)² = {f4(ss)}<br />s² = {f4(ss)} / ({a.n} − 1) = <b>{f4(a.variance)}</b><br />s = √{f4(a.variance)} = <b>{f4(a.sd)}</b></Work>
          <p>Median {a.median}, lowest {a.min}, highest {a.max}. How many students got each total score:</p>
          <Table>
            <TableHeader><TableRow><TableHead>Score</TableHead><TableHead>Students</TableHead></TableRow></TableHeader>
            <TableBody>{a.histogram.map((c, s) => c > 0 && (<TableRow key={s}><TableCell>{s}</TableCell><TableCell>{c}</TableCell></TableRow>))}</TableBody>
          </Table>
        </Section>

        <Section id="r-groups" num="4" title="Ranking and the High, Medium and Low groups">
          <p>Students are ranked from the highest total score to the lowest. Students with equal scores keep the order they have in your file. The first g students in this ranking are the <b>High</b> group, the last g are the <b>Low</b> group, and everyone in between is <b>Medium</b>.</p>
          <Formula>g = n ÷ 3, rounded down to a whole number<br />Medium = n − 2 × g</Formula>
          <Work>{a.n} ÷ 3 = {fmt(a.n / 3, 2)} → g = <b>{a.g}</b><br />High = {a.g} students, Low = {a.g} students<br />Medium = {a.n} − 2 × {a.g} = <b>{a.nMedium}</b> students{a.nMedium !== a.g ? ` (the ${a.nMedium - a.g} left over go to Medium)` : ''}<br />High group scores {a.cutoff.highScore} or more; Low group scores {a.cutoff.lowScore} or less</Work>
          {a.warnings.filter((x) => x.includes('cut-off')).map((x) => <p key={x} className="rounded-md border border-warning/30 bg-warning-soft px-4 py-3 text-sm">{x}</p>)}
          <div className="grid gap-6 md:grid-cols-2">
            {([['High group', a.high], ['Low group', a.low]] as const).map(([title, idx]) => (
              <div key={title}>
                <h4 className="mb-2 text-base font-semibold">{title} ({idx.length} students)</h4>
                <div className="max-h-72 overflow-auto rounded-md border">
                  <Table><TableHeader><TableRow><TableHead>Position</TableHead><TableHead>Student</TableHead><TableHead>Score</TableHead></TableRow></TableHeader>
                    <TableBody>{idx.map((i) => { const r = rankRow(i); return <TableRow key={i}><TableCell>{r.pos}</TableCell><TableCell>{r.id}</TableCell><TableCell>{r.total}</TableCell></TableRow> })}</TableBody></Table>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section id="r-ia" num="5" title="Item analysis % (High + Low)">
          <p>This is the headline figure. It looks only at the High and Low groups and asks: of all the students in those two groups, what share answered the question correctly? The Medium group is left out.</p>
          <Formula>Item analysis % = ( High correct + Low correct ) ÷ ( High total + Low total ) × 100</Formula>
          <Table>
            <TableHeader><TableRow><TableHead>Question</TableHead><TableHead>High correct</TableHead><TableHead>Low correct</TableHead><TableHead>Working</TableHead><TableHead>Item analysis %</TableHead></TableRow></TableHeader>
            <TableBody>{a.items.map((i) => (<TableRow key={i.index}><TableCell className="font-semibold">{i.label}</TableCell><TableCell>{i.highCorrect} of {a.g}</TableCell><TableCell>{i.lowCorrect} of {a.g}</TableCell>
              <TableCell><Mono>({i.highCorrect} + {i.lowCorrect}) ÷ ({a.g} + {a.g}) × 100 = {i.highCorrect + i.lowCorrect} ÷ {i.hlDenominator} × 100</Mono></TableCell><TableCell className="font-semibold">{fmt(i.hlPercentR, 1)}%</TableCell></TableRow>))}</TableBody>
          </Table>
        </Section>

        <Section id="r-dif" num="6" title="Difficulty index (DIF)">
          <Formula>DIF = ( c / n ) × 100</Formula>
          <Note>The higher the DIF, the easier the question. Acceptable: 30% to 70%. Above 70%: too easy. Below 30%: too difficult.</Note>
          <Table>
            <TableHeader><TableRow><TableHead>Question</TableHead><TableHead>c</TableHead><TableHead>Working</TableHead><TableHead>DIF</TableHead><TableHead>Rating</TableHead></TableRow></TableHeader>
            <TableBody>{a.items.map((i) => (<TableRow key={i.index}><TableCell className="font-semibold">{i.label}</TableCell><TableCell>{i.correct}</TableCell><TableCell><Mono>({i.correct} / {a.n}) × 100</Mono></TableCell><TableCell className="font-semibold">{fmt(i.difR, 1)}%</TableCell><TableCell><RatingBadge r={i.difRating} /></TableCell></TableRow>))}</TableBody>
          </Table>
        </Section>

        <Section id="r-di" num="7" title="Discrimination index (DI)">
          <Formula>DI = ( H / g ) − ( L / g )</Formula>
          <Note>H and L are the numbers of students in the High and Low group who answered the question correctly. Ranges from −1 to +1. 0.40 or more: excellent. 0.30 to 0.39: good. 0.20 to 0.29: acceptable. Below 0.20: poor. Below 0: defective (low scorers did better than high scorers).</Note>
          <Table>
            <TableHeader><TableRow><TableHead>Question</TableHead><TableHead>H</TableHead><TableHead>L</TableHead><TableHead>Working</TableHead><TableHead>DI</TableHead><TableHead>Rating</TableHead></TableRow></TableHeader>
            <TableBody>{a.items.map((i) => (<TableRow key={i.index}><TableCell className="font-semibold">{i.label}</TableCell><TableCell>{i.highCorrect}</TableCell><TableCell>{i.lowCorrect}</TableCell>
              <TableCell><Mono>({i.highCorrect}/{a.g}) − ({i.lowCorrect}/{a.g}) = {f4(i.highCorrect / a.g)} − {f4(i.lowCorrect / a.g)}</Mono></TableCell><TableCell className="font-semibold">{signed(i.diR)}</TableCell><TableCell><RatingBadge r={i.diRating} /></TableCell></TableRow>))}</TableBody>
          </Table>
        </Section>

        <Section id="r-de" num="8" title="Distractor analysis">
          <p>A distractor is a wrong option. First, how many students chose each option, as a percentage of all {a.n} students:</p>
          <Formula>option % = ( students who chose it / n ) × 100</Formula>
          <Table>
            <TableHeader><TableRow><TableHead>Question</TableHead><TableHead>Key</TableHead>{letters.map((l) => <TableHead key={l}>{l}</TableHead>)}</TableRow></TableHeader>
            <TableBody>{a.items.map((i) => (<TableRow key={i.index}><TableCell className="font-semibold">{i.label}</TableCell><TableCell>{i.key}</TableCell>{letters.map((l) => (
              i.optionPct[l] === undefined ? <TableCell key={l} className="text-muted-foreground">–</TableCell> : <TableCell key={l} className={l === i.key ? 'bg-success-soft font-semibold' : i.optionPct[l] < NFD_CUTOFF_PCT ? 'bg-destructive-soft' : ''}><Mono>{i.optionCounts[l]}/{a.n} = {fmt(i.optionPct[l], 1)}%</Mono></TableCell>))}</TableRow>))}</TableBody>
          </Table>
          <p>A wrong option chosen by fewer than {NFD_CUTOFF_PCT}% of students is <b>non-functional</b> (NFD): it does not distract anyone. Distractor efficiency is the share of wrong options that work:</p>
          <Formula>DE = ( wrong options − NFDs ) / wrong options × 100</Formula>
          <Note>The number of wrong options is one fewer than the number of options ({a.nOptions - 1} here for a question with {a.nOptions} options). 0 NFD: excellent. 1: good. 2 or more: needs revision; all wrong options unused: poor.</Note>
          <Table>
            <TableHeader><TableRow><TableHead>Question</TableHead><TableHead>Non-functional options</TableHead><TableHead>Working</TableHead><TableHead>DE</TableHead><TableHead>Rating</TableHead></TableRow></TableHeader>
            <TableBody>{a.items.map((i) => (<TableRow key={i.index}><TableCell className="font-semibold">{i.label}</TableCell><TableCell>{i.nfd.join(', ') || 'none'}</TableCell><TableCell><Mono>({i.nWrong} − {i.nfd.length}) / {i.nWrong} × 100</Mono></TableCell><TableCell className="font-semibold">{fmt(i.deR, 1)}%</TableCell><TableCell><RatingBadge r={i.deRating} /></TableCell></TableRow>))}</TableBody>
          </Table>
        </Section>

        <Section id="r-alpha" num="9" title="Reliability (Cronbach's alpha)">
          <p>Reliability describes how consistently the whole paper measures the same thing. For each question, with p = c / n and q = 1 − p, the variance of its 0/1 scores is:</p>
          <Formula>σ² = n × p × q / (n − 1)</Formula>
          <Table>
            <TableHeader><TableRow><TableHead>Question</TableHead><TableHead>c</TableHead><TableHead>p</TableHead><TableHead>q</TableHead><TableHead>Working</TableHead><TableHead>σ²</TableHead></TableRow></TableHeader>
            <TableBody>{a.items.map((i) => (<TableRow key={i.index}><TableCell className="font-semibold">{i.label}</TableCell><TableCell>{i.correct}</TableCell><TableCell>{f4(i.p)}</TableCell><TableCell>{f4(1 - i.p)}</TableCell><TableCell><Mono>{a.n} × {f4(i.p)} × {f4(1 - i.p)} / {a.n - 1}</Mono></TableCell><TableCell className="font-semibold">{f4(i.variance)}</TableCell></TableRow>))}
              <TableRow><TableCell colSpan={5} className="font-semibold">Σσ² (sum of the question variances)</TableCell><TableCell className="font-semibold">{f4(a.sumItemVar)}</TableCell></TableRow></TableBody>
          </Table>
          <Formula>α = k / (k − 1) × ( 1 − Σσ² / σ²ₜ )</Formula>
          <Note>σ²ₜ is the variance of the total scores, calculated in step 3. For right/wrong questions this is identical to KR-20.</Note>
          {a.alpha === null ? (
            <p className="rounded-md border border-warning/30 bg-warning-soft px-4 py-3">Every student has the same total score, so σ²ₜ = 0 and alpha cannot be calculated.</p>
          ) : (
            <Work>σ²ₜ = {f4(a.variance)}<br />Σσ² / σ²ₜ = {f4(a.sumItemVar)} / {f4(a.variance)} = {f4(ratio)}<br />1 − {f4(ratio)} = {f4(1 - ratio)}<br />k / (k − 1) = {a.k} / {a.k - 1} = {f4(a.k / (a.k - 1))}<br />α = {f4(a.k / (a.k - 1))} × {f4(1 - ratio)} = <b>{f4(a.alpha)}</b> → {fmt(a.alpha, 2)}</Work>
          )}
          <p className="flex flex-wrap items-center gap-3">Rating: <RatingBadge r={a.alphaRating} /><span className="text-sm text-muted-foreground">0.80 or more: high (high-stakes exams). 0.70 to 0.79: acceptable for classroom assessments. Below 0.70: low.</span></p>
        </Section>

        <Section id="r-rules" num="10" title="How the recommended action is decided">
          <p>The first rule that applies, from the top, decides the action for a question:</p>
          <ol className="list-decimal space-y-1.5 pl-6 marker:font-semibold marker:text-primary">
            <li>Discrimination is negative: check the answer key or a confusing stem.</li>
            <li>Two or more of the three ratings (difficulty, discrimination, distractors) are red: the question is flawed; revise the stem and options.</li>
            <li>One rating is red: revise, looking at the red rating.</li>
            <li>A distractor is non-functional: keep the question and tweak the weak distractor(s).</li>
            <li>A rating is amber: keep it, with a minor review.</li>
            <li>All ratings are green: keep it in the question bank.</li>
          </ol>
          <Table>
            <TableHeader><TableRow><TableHead>Question</TableHead><TableHead>Difficulty</TableHead><TableHead>Discrimination</TableHead><TableHead>Distractors</TableHead><TableHead>Rule applied</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
            <TableBody>{a.items.map((i) => (<TableRow key={i.index}><TableCell className="font-semibold">{i.label}</TableCell><TableCell><RatingBadge r={i.difRating} /></TableCell><TableCell><RatingBadge r={i.diRating} /></TableCell><TableCell><RatingBadge r={i.deRating} /></TableCell><TableCell className="min-w-[14rem]">{i.action.rule}</TableCell><TableCell><Badge variant={variantOf(i.action.level)} className="whitespace-normal">{i.action.text}</Badge></TableCell></TableRow>))}</TableBody>
          </Table>
        </Section>

        <Section id="r-each" num="11" title="One question at a time">
          <p>Open a question to see every calculation for it in one place, with your numbers filled in.</p>
          <Accordion type="multiple" defaultValue={[`q-0`]} className="rounded-lg border px-5">
            {a.items.map((i) => (
              <AccordionItem key={i.index} value={`q-${i.index}`}>
                <AccordionTrigger><span className="flex flex-wrap items-center gap-3"><span>{i.label}</span><Badge variant={variantOf(i.action.level)}>{i.action.text}</Badge></span></AccordionTrigger>
                <AccordionContent>
                  <Work>
                    <b>Step 1. Everyone</b><br />Correct c = {i.correct} of n = {a.n} students; incorrect = {a.n - i.correct}<br />
                    Difficulty index = ({i.correct} ÷ {a.n}) × 100 = <b>{fmt(i.dif, 2)}%</b> → {fmt(i.difR, 1)}% ({i.difRating.label})<br /><br />
                    <b>Step 2. The groups</b><br />High group: {i.highCorrect} of {a.g} correct. Low group: {i.lowCorrect} of {a.g} correct<br /><br />
                    <b>Step 3. Item analysis %</b><br />({i.highCorrect} + {i.lowCorrect}) ÷ ({a.g} + {a.g}) × 100 = {i.highCorrect + i.lowCorrect} ÷ {i.hlDenominator} × 100 = <b>{fmt(i.hlPercent, 2)}%</b> → {fmt(i.hlPercentR, 1)}%<br /><br />
                    <b>Step 4. Discrimination index</b><br />({i.highCorrect} ÷ {a.g}) − ({i.lowCorrect} ÷ {a.g}) = {f4(i.highCorrect / a.g)} − {f4(i.lowCorrect / a.g)} = <b>{f4(i.di)}</b> → {signed(i.diR)} ({i.diRating.label})<br /><br />
                    <b>Step 5. Options chosen</b><br />{Object.keys(i.optionCounts).map((l) => `${l}${l === i.key ? ' (key)' : ''}: ${i.optionCounts[l]} of ${a.n} = ${fmt(i.optionPct[l], 1)}%`).join('  |  ')}<br />
                    Wrong options chosen by fewer than {NFD_CUTOFF_PCT}%: {i.nfd.join(', ') || 'none'} → NFD = {i.nfd.length}<br />
                    Distractor efficiency = ({i.nWrong} − {i.nfd.length}) ÷ {i.nWrong} × 100 = <b>{fmt(i.de, 2)}%</b> → {fmt(i.deR, 1)}% ({i.deRating.label})<br /><br />
                    <b>Step 6. Reliability input</b><br />p = {i.correct} ÷ {a.n} = {f4(i.p)}; q = {f4(1 - i.p)}; variance = {a.n} × {f4(i.p)} × {f4(1 - i.p)} ÷ {a.n - 1} = {f4(i.variance)}<br /><br />
                    <b>Step 7. Decision</b><br />{i.action.rule} → <b>{i.action.text}</b>
                  </Work>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Section>

        <Section id="r-limits" num="12" title="Assumptions and limits">
          <ul className="list-disc space-y-2 pl-6 marker:text-primary">
            <li>Each question has one correct option. Blank answers and answers that are not valid option letters count as wrong.</li>
            <li>{a.dataset.textMode ? 'Because the answers are words, the number of options of each question is the number of different answers found for it.' : `Every question is assumed to have ${a.nOptions} options, because that is the highest option letter found in the answers and key (with a minimum of A to D).`}</li>
            <li>Ratings use the values as displayed: difficulty to one decimal place, discrimination to two, alpha to two. Halves round up.</li>
            <li>The High and Low groups each hold one third of the students (rounded down); the remainder is Medium. Where several students share the cut-off score, those placed in the group are chosen by their order in your file.</li>
            <li>With fewer than about 30 students, discrimination and reliability are unstable. Treat them as indicative.</li>
            <li>These statistics describe how the questions behaved for this group of students. They support, and do not replace, expert judgement about each question.</li>
          </ul>
        </Section>
      </article>
    </div>
  )
}
