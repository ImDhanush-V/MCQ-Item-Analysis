import { ArrowRight, Download, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BlurText } from '@/components/bits/BlurText'
import { Reveal } from '@/components/bits/Reveal'
import { SpotlightCard } from '@/components/bits/SpotlightCard'
import { site } from '@/config'

const outputs = [
  { n: '01', t: 'Item analysis %', d: 'Correct answers in the High and Low groups, as a share of both groups.' },
  { n: '02', t: 'Difficulty', d: 'The share of students who answered each question correctly.' },
  { n: '03', t: 'Discrimination', d: 'Whether top scorers beat bottom scorers on each question.' },
  { n: '04', t: 'Distractors', d: 'Which wrong options students actually chose.' },
  { n: '05', t: 'Reliability', d: "Cronbach's alpha for the whole paper." },
]

export function Hero() {
  return (
    <section id="top" className="border-b bg-background print:hidden">
      <div className="container grid items-center gap-12 py-14 md:grid-cols-[1.15fr_1fr] md:py-20">
        <div>
          <Reveal><p className="mb-4 text-[13px] font-semibold uppercase tracking-wider text-primary">Item analysis for multiple-choice exams</p></Reveal>
          <h1 className="text-4xl font-semibold leading-[1.1] md:text-[3.25rem]">
            <BlurText text="Understand how well each question performed." />
          </h1>
          <Reveal delay={0.15}>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Upload your students' answers in Excel, with the answer key in the same sheet or separately. You get a clear verdict on every question, and each calculation is shown step by step.
            </p>
          </Reveal>
          <Reveal delay={0.25} className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg"><a href="#analyse">Start analysis<ArrowRight /></a></Button>
            <Button asChild size="lg" variant="outline"><a href={site.templateUrl} download><Download />Download template</a></Button>
          </Reveal>
          <Reveal delay={0.32}>
            <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground"><Lock className="size-4 shrink-0" aria-hidden="true" />{site.privacyLine}</p>
          </Reveal>
        </div>
        <Reveal delay={0.2}>
          <SpotlightCard>
            <div className="p-7">
              <h2 className="text-lg font-semibold">What you receive</h2>
              <ul className="mt-5 divide-y">
                {outputs.map((o) => (
                  <li key={o.n} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                    <span className="w-7 shrink-0 pt-0.5 text-sm font-semibold text-primary tabular">{o.n}</span>
                    <div><p className="font-semibold">{o.t}</p><p className="mt-0.5 text-sm text-muted-foreground">{o.d}</p></div>
                  </li>
                ))}
              </ul>
            </div>
          </SpotlightCard>
        </Reveal>
      </div>
    </section>
  )
}
