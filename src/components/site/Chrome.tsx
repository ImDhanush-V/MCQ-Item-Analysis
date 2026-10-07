import { Download, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { site } from '@/config'

const link = 'relative text-sm font-medium text-foreground/80 transition-colors after:absolute after:-bottom-1 after:left-0 after:h-0.5 after:w-full after:origin-left after:scale-x-0 after:bg-primary after:transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 rounded-sm'

export function TopBar() {
  return (
    <div className="bg-primary text-primary-foreground print:hidden">
      <div className="container flex h-10 items-center justify-between gap-4 text-[13px]">
        <span className="hidden sm:inline">{site.org}</span>
        <nav aria-label="Utility" className="ml-auto flex items-center gap-5">
          <a className="underline-offset-4" href={site.templateUrl} download>Template</a>
          <a className="underline-offset-4" href="#prepare">Help</a>
          <a className="inline-flex items-center gap-1.5 underline-offset-4" href={`mailto:${site.contactEmail}`}><Mail className="size-3.5" aria-hidden="true" />Contact</a>
        </nav>
      </div>
    </div>
  )
}

export function Header({ hasResults }: { hasResults: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur print:hidden">
      <div className="container flex h-16 items-center justify-between gap-6">
        <a href="#top" className="flex flex-col leading-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 rounded-sm">
          <span className="text-lg font-semibold tracking-tight text-primary">{site.name}</span>
          <span className="hidden text-[13px] text-muted-foreground sm:block">Item analysis for multiple-choice exams</span>
        </a>
        <nav aria-label="Main" className="flex items-center gap-4 sm:gap-7">
          <a className={link} href="#prepare">Prepare file</a>
          <a className={link} href="#analyse">Analyse</a>
          {hasResults && <a className={link} href="#results">Results</a>}
          <Button asChild variant="outline" size="sm" className="hidden md:inline-flex"><a href={site.templateUrl} download><Download />Template</a></Button>
        </nav>
      </div>
    </header>
  )
}

export function Footer() {
  const col = 'flex flex-col gap-2.5 text-sm'
  const a = 'text-white/75 underline-offset-4 transition-colors'
  return (
    <footer className="bg-foreground text-white print:hidden">
      <div className="container grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="max-w-sm">
          <p className="text-lg font-semibold">{site.name}</p>
          <p className="mt-3 text-sm leading-relaxed text-white/75">{site.privacyLine} Results support, and do not replace, expert judgement about each question.</p>
        </div>
        <nav aria-label="Tool" className={col}>
          <p className="mb-1 text-[13px] font-semibold uppercase tracking-wider text-white/60">Tool</p>
          <a className={a} href="#prepare">Prepare your file</a><a className={a} href="#analyse">Upload and analyse</a><a className={a} href={site.templateUrl} download>Download template</a>
        </nav>
        <div className={col}>
          <p className="mb-1 text-[13px] font-semibold uppercase tracking-wider text-white/60">Contact</p>
          <a className={a} href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>
        </div>
      </div>
      <div className="border-t border-white/15">
        <div className="container py-5 text-[13px] text-white/60">Statistics: Cronbach's alpha, difficulty index, discrimination index (High and Low thirds), distractor efficiency.</div>
      </div>
    </footer>
  )
}
