'use client'

import { cn } from '@talelabs/ui/lib/utils'

export function FieldSet({
  className,
  ...props
}: React.ComponentProps<'fieldset'>) {
  return (
    <fieldset
      data-slot="field-set"
      className={cn(
        `
          flex flex-col gap-6
          has-[>[data-slot=checkbox-group]]:gap-3
          has-[>[data-slot=radio-group]]:gap-3
        `,
        className,
      )}
      {...props}
    />
  )
}

export function FieldLegend({
  className,
  variant = 'legend',
  ...props
}: React.ComponentProps<'legend'> & { variant?: 'legend' | 'label' }) {
  return (
    <legend
      data-slot="field-legend"
      data-variant={variant}
      className={cn(
        `
          mb-3 font-medium
          data-[variant=label]:text-sm
          data-[variant=legend]:text-base
        `,
        className,
      )}
      {...props}
    />
  )
}

export function FieldGroup({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="field-group"
      className={cn(
        `
          group/field-group @container/field-group flex w-full flex-col gap-7
          data-[slot=checkbox-group]:gap-3
          *:data-[slot=field-group]:gap-4
        `,
        className,
      )}
      {...props}
    />
  )
}
