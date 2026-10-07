// Number that counts up when scrolled into view (React Bits "CountUp" pattern) using motion.dev.
import { useEffect, useRef } from 'react'
import { animate, useInView, useMotionValue, useReducedMotion } from 'motion/react'
import { fmt } from '@/lib/format'
import { cn } from '@/lib/utils'

interface CountUpProps {
  to: number
  from?: number
  decimals?: number
  duration?: number
  className?: string
}

export function CountUp({ to, from = 0, decimals = 0, duration = 1.1, className }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  const reduce = useReducedMotion()
  const value = useMotionValue(from)

  useEffect(() => {
    if (reduce || !inView) return
    const write = (v: number) => {
      if (ref.current) ref.current.textContent = fmt(v, decimals)
    }
    value.set(from)
    const stop = value.on('change', write)
    const controls = animate(value, to, { duration, ease: 'easeOut', onComplete: () => write(to) })
    return () => {
      stop()
      controls.stop()
    }
  }, [inView, to, from, decimals, duration, reduce, value])

  return (
    <span ref={ref} className={cn('tabular', className)}>
      {fmt(reduce ? to : from, decimals)}
    </span>
  )
}
