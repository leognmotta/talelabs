import { cn } from '@talelabs/ui/lib/utils'

export function ItemTitle({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="item-title"
      className={cn(
        `
          line-clamp-1 flex w-fit items-center gap-2 text-sm/snug font-medium
          underline-offset-4
        `,
        className,
      )}
      {...props}
    />
  )
}

export function ItemDescription({
  className,
  ...props
}: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="item-description"
      className={cn(
        `
          line-clamp-2 text-left text-sm font-normal text-muted-foreground
          [&>a]:underline [&>a]:underline-offset-4
          [&>a:hover]:text-link
        `,
        className,
      )}
      {...props}
    />
  )
}
