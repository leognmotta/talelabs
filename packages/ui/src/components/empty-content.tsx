import { cn } from '@talelabs/ui/lib/utils'

export function EmptyTitle({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="empty-title"
      className={cn('text-lg font-medium tracking-tight', className)}
      {...props}
    />
  )
}

export function EmptyDescription({
  className,
  ...props
}: React.ComponentProps<'p'>) {
  return (
    <div
      data-slot="empty-description"
      className={cn(
        `
          text-sm/relaxed text-muted-foreground
          [&>a]:underline [&>a]:underline-offset-4
          [&>a:hover]:text-link
        `,
        className,
      )}
      {...props}
    />
  )
}

export function EmptyContent({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="empty-content"
      className={cn(
        `
          flex w-full max-w-sm min-w-0 flex-col items-center gap-4 text-sm
          text-balance
        `,
        className,
      )}
      {...props}
    />
  )
}
