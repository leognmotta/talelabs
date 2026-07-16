import { cn } from '@talelabs/ui/lib/utils'

export function Empty({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="empty"
      className={cn(
        `
          flex w-full min-w-0 flex-1 flex-col items-center justify-center gap-4
          rounded-2xl border-dashed p-12 text-center text-balance
        `,
        className,
      )}
      {...props}
    />
  )
}

export function EmptyHeader({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="empty-header"
      className={cn('flex max-w-sm flex-col items-center gap-2', className)}
      {...props}
    />
  )
}
