import type { VariantProps } from 'class-variance-authority'
import { cn } from '@talelabs/ui/lib/utils'
import { cva } from 'class-variance-authority'

const itemMediaVariants = cva(
  `
    flex shrink-0 items-center justify-center gap-2
    group-has-data-[slot=item-description]/item:translate-y-0.5
    group-has-data-[slot=item-description]/item:self-start
    [&_svg]:pointer-events-none
  `,
  {
    variants: {
      variant: {
        default: 'bg-transparent',
        icon: '[&_svg:not([class*=\'size-\'])]:size-4',
        image: `
          size-10 overflow-hidden rounded-xl
          group-data-[size=sm]/item:size-8
          group-data-[size=xs]/item:size-6 group-data-[size=xs]/item:rounded-lg
          [&_img]:size-full [&_img]:object-cover
        `,
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export function ItemMedia({
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof itemMediaVariants>) {
  return (
    <div
      data-slot="item-media"
      data-variant={variant}
      className={cn(itemMediaVariants({ variant, className }))}
      {...props}
    />
  )
}

export function ItemContent({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="item-content"
      className={cn(
        `
          flex flex-1 flex-col gap-1
          group-data-[size=xs]/item:gap-0.5
          [&+[data-slot=item-content]]:flex-none
        `,
        className,
      )}
      {...props}
    />
  )
}

export function ItemActions({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="item-actions"
      className={cn('flex items-center gap-2', className)}
      {...props}
    />
  )
}
