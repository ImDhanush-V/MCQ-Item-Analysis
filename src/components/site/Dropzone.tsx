import { useId, useState, type DragEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { AlertCircle, CheckCircle2, FileSpreadsheet, Loader2, UploadCloud } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { SlotState } from '@/hooks/useWorkspace'

interface Props {
  step: string
  title: string
  hint: string
  optional?: boolean
  slot: SlotState
  onFile: (f: File) => void
  onClear: () => void
}

export function Dropzone({ step, title, hint, optional, slot, onFile, onClear }: Props) {
  const inputId = useId()
  const [over, setOver] = useState(false)
  const take = (files: FileList | null) => { if (files && files[0]) onFile(files[0]) }
  const onDrop = (e: DragEvent) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files) }
  const s = slot.status
  const tone = s === 'ready' ? 'border-success/60 bg-success-soft/50' : s === 'error' ? 'border-destructive/60 bg-destructive-soft/60' : over ? 'border-primary bg-accent' : 'border-input bg-background'
  const sheets = slot.wb?.sheets.map((x) => x.name).join(', ')

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold">
          <span className="mr-2 text-muted-foreground">{step}</span>
          {title}
        </h3>
        <Badge variant={optional ? 'secondary' : 'outline'}>{optional ? 'Optional' : 'Required'}</Badge>
      </div>
      <label
        htmlFor={inputId}
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={cn('relative flex min-h-[176px] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-all duration-200 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2', tone, s === 'loading' && 'cursor-progress')}
      >
        <input id={inputId} type="file" accept=".xlsx" className="sr-only" onChange={(e) => { take(e.target.files); e.target.value = '' }} />
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={s} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }} className="flex flex-col items-center gap-2">
            {s === 'idle' && (<>
              <UploadCloud className="size-8 text-primary" aria-hidden="true" />
              <p className="text-base font-semibold">Drop your .xlsx file here</p>
              <p className="max-w-xs text-sm text-muted-foreground">{hint}</p>
              <span className="mt-1 inline-flex h-9 items-center rounded-md border border-input bg-background px-3.5 text-sm font-semibold shadow-sm">Choose file</span>
            </>)}
            {s === 'loading' && (<>
              <Loader2 className="size-8 animate-spin text-primary" aria-hidden="true" />
              <p className="text-base font-semibold">Reading {slot.file?.name}</p>
              <p className="text-sm text-muted-foreground">This takes a moment.</p>
            </>)}
            {s === 'ready' && (<>
              <CheckCircle2 className="size-8 text-success" aria-hidden="true" />
              <p className="break-all text-base font-semibold">{slot.file?.name}</p>
              <p className="text-sm text-muted-foreground">Read successfully. Sheets: {sheets}</p>
            </>)}
            {s === 'error' && (<>
              <AlertCircle className="size-8 text-destructive" aria-hidden="true" />
              <p className="break-all text-base font-semibold">{slot.file?.name}</p>
              <p className="max-w-sm text-sm text-destructive">{slot.message}</p>
            </>)}
          </motion.div>
        </AnimatePresence>
      </label>
      <div className="flex min-h-9 items-center gap-2" aria-live="polite">
        {(s === 'ready' || s === 'error') && (<>
          <Button variant="outline" size="sm" asChild><label htmlFor={inputId}><FileSpreadsheet />Replace file</label></Button>
          <Button variant="ghost" size="sm" onClick={onClear}>Remove</Button>
        </>)}
      </div>
    </div>
  )
}
