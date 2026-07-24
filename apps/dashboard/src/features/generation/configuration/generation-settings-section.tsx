/** Labeled settings group that preserves catalog section ordering. */

import type { ComponentProps, ReactNode } from 'react'

import { cn } from '@talelabs/ui/lib/utils'

/** Groups active setting fields under their catalog-defined section label. */
export function GenerationSettingsSection({
  children,
  className,
  divided = true,
  ...props
}: Omit<ComponentProps<'div'>, 'children'> & {
  children: ReactNode
  divided?: boolean
}) {
  return (
    <div
      {...props}
      className={cn(
        'flex flex-col gap-3',
        divided && 'border-t border-border/70 pt-4',
        className,
      )}
    >
      {children}
    </div>
  )
}
