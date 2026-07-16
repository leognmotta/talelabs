'use client'

import type { VariantProps } from 'class-variance-authority'

import { Label } from '@talelabs/ui/components/label'
import { cn } from '@talelabs/ui/lib/utils'
import { cva } from 'class-variance-authority'

const fieldVariants = cva(
  `
    group/field flex w-full gap-3
    data-[invalid=true]:text-destructive
  `,
  {
    variants: {
      orientation: {
        vertical: `
          flex-col
          *:w-full
          [&>.sr-only]:w-auto
        `,
        horizontal: `
          flex-row items-center
          has-[>[data-slot=field-content]]:items-start
          *:data-[slot=field-label]:flex-auto
          has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px
        `,
        responsive: `
          flex-col
          *:w-full
          @md/field-group:flex-row @md/field-group:items-center
          @md/field-group:*:w-auto
          @md/field-group:has-[>[data-slot=field-content]]:items-start
          @md/field-group:*:data-[slot=field-label]:flex-auto
          [&>.sr-only]:w-auto
          @md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px
        `,
      },
    },
    defaultVariants: { orientation: 'vertical' },
  },
)

export function Field({
  className,
  orientation = 'vertical',
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof fieldVariants>) {
  return (
    <div
      role="group"
      data-slot="field"
      data-orientation={orientation}
      className={cn(fieldVariants({ orientation }), className)}
      {...props}
    />
  )
}

export function FieldContent({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="field-content"
      className={cn(
        'group/field-content flex flex-1 flex-col gap-1 leading-snug',
        className,
      )}
      {...props}
    />
  )
}

export function FieldLabel({
  className,
  ...props
}: React.ComponentProps<typeof Label>) {
  return (
    <Label
      data-slot="field-label"
      className={cn(
        `
          group/field-label peer/field-label flex w-fit gap-2 leading-snug
          group-data-[disabled=true]/field:opacity-50
          has-data-checked:bg-input/30
          has-[>[data-slot=field]]:rounded-2xl has-[>[data-slot=field]]:border
          *:data-[slot=field]:p-4
        `,
        'has-[>[data-slot=field]]:w-full has-[>[data-slot=field]]:flex-col',
        className,
      )}
      {...props}
    />
  )
}
