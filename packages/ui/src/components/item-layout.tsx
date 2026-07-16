import { Separator } from '@talelabs/ui/components/separator'
import { cn } from '@talelabs/ui/lib/utils'

export function ItemGroup({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      role="list"
      data-slot="item-group"
      className={cn(
        `
          group/item-group flex w-full flex-col gap-4
          has-data-[size=sm]:gap-2.5
          has-data-[size=xs]:gap-2
        `,
        className,
      )}
      {...props}
    />
  )
}

export function ItemSeparator({
  className,
  ...props
}: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot="item-separator"
      orientation="horizontal"
      className={cn('my-2', className)}
      {...props}
    />
  )
}
