import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Plain rounded card. (The pointer-following highlight was removed on request: no hover effects.) */
export function SpotlightCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('rounded-2xl border bg-card shadow-sm', className)}>{children}</div>
}
