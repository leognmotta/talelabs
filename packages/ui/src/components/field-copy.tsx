'use client'

import { cn } from '@talelabs/ui/lib/utils'

export function FieldTitle({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="field-label"
      className={cn(
        `
          flex w-fit items-center gap-2 text-sm font-medium
          group-data-[disabled=true]/field:opacity-50
        `,
        className,
      )}
      {...props}
    />
  )
}

export function FieldDescription({
  className,
  ...props
}: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="field-description"
      className={cn(
        `
          text-left text-sm/normal font-normal text-muted-foreground
          group-has-data-horizontal/field:text-balance
          [[data-variant=legend]+&]:-mt-1.5
        `,
        `
          last:mt-0
          nth-last-2:-mt-1
        `,
        `
          [&>a]:underline [&>a]:underline-offset-4
          [&>a:hover]:text-link
        `,
        className,
      )}
      {...props}
    />
  )
}
