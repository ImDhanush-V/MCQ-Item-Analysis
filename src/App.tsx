import { useEffect, useRef } from 'react'
import { ClickSpark } from '@/components/bits/ClickSpark'
import { Footer, Header, TopBar } from '@/components/site/Chrome'
import { Hero } from '@/components/site/Hero'
import { Prepare } from '@/components/site/Prepare'
import { Workspace } from '@/components/site/Workspace'
import { Results, ResultsSkeleton } from '@/components/site/Results'
import { useWorkspace } from '@/hooks/useWorkspace'

export default function App() {
  const ws = useWorkspace()
  const seen = useRef(false)

  // When a successful analysis first appears, bring the results into view.
  useEffect(() => {
    if (ws.phase === 'done' && !seen.current) {
      seen.current = true
      setTimeout(() => document.getElementById('results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 250)
    }
    if (ws.phase !== 'done') seen.current = false
  }, [ws.phase])

  return (
    <>
      <a href="#analyse" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">Skip to the analysis</a>
      <TopBar />
      <Header hasResults={ws.phase === 'done'} />
      <main>
        <Hero />
        <Prepare />
        <Workspace ws={ws} />
        {ws.phase === 'working' && ws.step >= 2 && <ResultsSkeleton />}
        {ws.phase === 'done' && ws.analysis && <Results a={ws.analysis} hide={ws.hideIds} check={ws.check} />}
      </main>
      <Footer />
      <ClickSpark />
    </>
  )
}
