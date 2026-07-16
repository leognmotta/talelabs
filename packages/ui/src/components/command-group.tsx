import { cn } from '@talelabs/ui/lib/utils'
import { Command as CommandPrimitive } from 'cmdk'
import * as React from 'react'

export function CommandLoading({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Loading>) {
  return (
    <CommandPrimitive.Loading
      data-slot="command-loading"
      className={cn(
        'flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground',
        className,
      )}
      {...props}
    />
  )
}

export function CommandGroup({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      data-slot="command-group"
      className={cn(
        `
          overflow-hidden p-1.5 text-foreground
          **:[[cmdk-group-heading]]:px-3 **:[[cmdk-group-heading]]:py-2
          **:[[cmdk-group-heading]]:text-xs
          **:[[cmdk-group-heading]]:font-medium
          **:[[cmdk-group-heading]]:text-muted-foreground
        `,
        className,
      )}
      {...props}
    />
  )
}

export function CommandSeparator({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) {
  return (
    <CommandPrimitive.Separator
      data-slot="command-separator"
      className={cn('my-1.5 h-px bg-border/50', className)}
      {...props}
    />
  )
}
