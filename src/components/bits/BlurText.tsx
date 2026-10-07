// Word-by-word blur-in heading (React Bits "BlurText" pattern) using motion.dev.
import { useRef } from 'react'
import { motion, useInView, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'

interface BlurTextProps {
  text: string
  className?: string
  /** seconds between words */
  stagger?: number
}

export function BlurText({ text, className, stagger = 0.07 }: BlurTextProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '0px 0px -10% 0px' })
  const reduce = useReducedMotion()
  if (reduce) return <span className={className}>{text}</span>
  const words = text.split(' ')
  return (
    <span ref={ref} className={cn('block', className)} aria-label={text}>
      {words.map((word, i) => (
        <motion.span
          key={`${word}-${i}`}
          aria-hidden="true"
          className="inline-block"
          initial={{ filter: 'blur(10px)', opacity: 0, y: -14 }}
          animate={inView ? { filter: 'blur(0px)', opacity: 1, y: 0 } : undefined}
          transition={{ duration: 0.6, delay: i * stagger, ease: [0.22, 1, 0.36, 1] }}
        >
          {word}
          {i < words.length - 1 ? '\u00A0' : ''}
        </motion.span>
      ))}
    </span>
  )
}
