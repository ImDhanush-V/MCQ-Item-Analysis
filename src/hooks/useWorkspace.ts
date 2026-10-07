import { useCallback, useState } from 'react'
import { applyEdits, checkInputs, editKey, type Edits } from '@/lib/check'
import { analyse, type Analysis } from '@/lib/stats'
import { readWorkbook, ReadError } from '@/lib/read'
import { norm } from '@/lib/text'
import type { CheckResult, Issue, WorkbookData } from '@/lib/types'

export type Kind = 'resp' | 'key'
export interface SlotState { status: 'idle' | 'loading' | 'ready' | 'error'; file?: File; wb?: WorkbookData; message?: string }
export type Phase = 'idle' | 'working' | 'fixes' | 'needsKey' | 'done' | 'crashed'
export const STEPS = ['Reading files', 'Checking layout', 'Calculating statistics', 'Preparing report'] as const
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function useWorkspace() {
  const [slots, setSlots] = useState<Record<Kind, SlotState>>({ resp: { status: 'idle' }, key: { status: 'idle' } })
  const [phase, setPhase] = useState<Phase>('idle')
  const [step, setStep] = useState(0)
  const [check, setCheck] = useState<CheckResult | null>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [hideIds, setHideIds] = useState(false)
  const [crash, setCrash] = useState('')
  const [edits, setEdits] = useState<Edits>({})
  const [typedKey, setTypedKey] = useState<Record<string, string> | undefined>(undefined)

  const reset = () => { setPhase('idle'); setCheck(null); setAnalysis(null); setCrash(''); setEdits({}); setTypedKey(undefined) }
  const patch = (kind: Kind, s: SlotState) => setSlots((p) => ({ ...p, [kind]: s }))

  const load = useCallback(async (kind: Kind, file: File) => {
    reset()
    patch(kind, { status: 'loading', file })
    try {
      const [wb] = await Promise.all([readWorkbook(file), sleep(350)])
      patch(kind, { status: 'ready', file, wb })
    } catch (e) {
      patch(kind, { status: 'error', file, message: e instanceof ReadError ? e.message : 'This file could not be read. Try saving a fresh .xlsx copy.' })
    }
  }, [])
  const clear = useCallback((kind: Kind) => { reset(); patch(kind, { status: 'idle' }) }, [])

  const setEdit = useCallback((i: Issue, value: string) => setEdits((p) => {
    const k = editKey(i.file, i.sheet, i.cell)
    const n = { ...p }
    if (value === '') delete n[k]; else n[k] = value
    return n
  }), [])
  const editValue = (i: Issue) => edits[editKey(i.file, i.sheet, i.cell)] ?? ''

  const execute = useCallback(async (e: Edits, tk: Record<string, string> | undefined, quick: boolean) => {
    const wb = slots.resp.wb
    if (!wb) return
    setPhase('working'); setStep(1); setCheck(null); setAnalysis(null)
    try {
      await sleep(quick ? 150 : 350)
      const c = checkInputs(applyEdits(wb, e), slots.key.wb ? applyEdits(slots.key.wb, e) : null, { typedKey: tk })
      setCheck(c)
      if (c.needsKey) { setPhase('needsKey'); return }
      if (!c.ok) { setPhase('fixes'); return }
      setStep(2); await sleep(quick ? 150 : 350)
      const a = analyse(c.dataset!)
      setStep(3); await sleep(quick ? 100 : 300)
      setAnalysis(a); setPhase('done')
    } catch (err) {
      setCrash(err instanceof Error ? err.message : String(err)); setPhase('crashed')
    }
  }, [slots])

  const run = useCallback(() => execute(edits, typedKey, false), [execute, edits, typedKey])
  /** Re-check after the user typed corrections into the page. */
  const recheck = useCallback(() => execute(edits, typedKey, true), [execute, edits, typedKey])
  /** Use a key chosen on the page (question heading, normalised -> option letter or option text). */
  const useTypedKey = useCallback((k: Record<string, string>) => { setTypedKey(k); return execute(edits, k, true) }, [execute, edits])

  return { slots, load, clear, phase, step, check, analysis, hideIds, setHideIds, run, recheck, useTypedKey, crash, edits, setEdit, editValue, editCount: Object.keys(edits).length, normHeading: norm }
}
