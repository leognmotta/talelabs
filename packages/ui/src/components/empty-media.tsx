import type { VariantProps } from 'class-variance-authority'

import { cn } from '@talelabs/ui/lib/utils'
import { cva } from 'class-variance-authority'

const emptyMediaVariants = cva(
  `
    mb-2 flex shrink-0 items-center justify-center
    [&_svg]:pointer-events-none [&_svg]:shrink-0
  `,
  {
    variants: {
      variant: {
        default: 'bg-transparent',
        icon: `
          flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted
          text-foreground
          [&_svg:not([class*='size-'])]:size-5
        `,
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export function EmptyMedia({
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof emptyMediaVariants>) {
  return (
    <div
      data-slot="empty-icon"
      data-variant={variant}
      className={cn(emptyMediaVariants({ variant, className }))}
      {...props}
    />
  )
}
