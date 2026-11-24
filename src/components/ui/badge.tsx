import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Check, CheckCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

const badgeVariants = cva('inline-flex items-center rounded-md border font-semibold whitespace-nowrap transition-colors', {
  variants: {
    variant: {
      default: 'border-transparent bg-primary text-primary-foreground',
      secondary: 'border-transparent bg-secondary text-secondary-foreground',
      outline: 'text-foreground',
      // Excellent: mint / emerald green (unchanged)
      success: 'border-[hsl(152_45%_50%)] bg-[hsl(152_45%_87%)] text-[hsl(152_62%_18%)]',
      // Good: teal — clearly distinct from the mint-green excellent, still a positive/calm tone
      ok: 'border-[hsl(174_50%_45%)] bg-[hsl(174_50%_90%)] text-[hsl(174_60%_20%)]',
      warning: 'border-warning/25 bg-warning-soft text-warning',
      destructive: 'border-destructive/25 bg-destructive-soft text-destructive',
    },
    size: {
      default: 'px-2.5 py-0.5 text-[13px] leading-5',
      sm: 'px-2 py-0 text-xs leading-5',
    },
  },
  defaultVariants: { variant: 'default', size: 'default' },
})

// Default icon per tier, so the rating never relies on color alone.
const tierIcons: Record<string, React.ElementType> = {
  success: CheckCheck,
  ok: Check,
}

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {
  /** Show the default icon for this variant (double check = excellent, check = good). */
  withIcon?: boolean
  /** Custom leading icon; overrides the default icon. */
  icon?: React.ReactNode
}

function Badge({ className, variant, size, withIcon, icon, children, ...props }: BadgeProps) {
  const DefaultIcon = variant ? tierIcons[variant] : undefined
  const leading = icon ?? (withIcon && DefaultIcon ? <DefaultIcon aria-hidden className="size-3.5 shrink-0" /> : null)

  return (
    <div className={cn(badgeVariants({ variant, size }), leading && 'gap-1', className)} {...props}>
      {leading}
      {children}
    </div>
  )
}

export { Badge, badgeVariants }