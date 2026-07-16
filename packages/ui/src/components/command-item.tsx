import { IconCheck } from '@tabler/icons-react'
import { cn } from '@talelabs/ui/lib/utils'
import { Command as CommandPrimitive } from 'cmdk'
import * as React from 'react'

export function CommandItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      className={cn(
        `
          group/command-item relative flex cursor-pointer items-center gap-2
          rounded-2xl px-3 py-2 text-sm font-medium outline-hidden select-none
          in-data-[slot=dialog-content]:rounded-3xl
          data-[disabled=true]:pointer-events-none
          data-[disabled=true]:opacity-50
          data-selected:bg-accent data-selected:text-accent-foreground
          [&_svg]:pointer-events-none [&_svg]:shrink-0
          [&_svg:not([class*='size-'])]:size-4
          data-selected:*:[svg]:text-accent-foreground
        `,
        className,
      )}
      {...props}
    >
      {children}
      <IconCheck className="
        ml-auto opacity-0
        group-has-data-[slot=command-shortcut]/command-item:hidden
        group-data-[checked=true]/command-item:opacity-100
      "
      />
    </CommandPrimitive.Item>
  )
}

export function CommandShortcut({
  className,
  ...props
}: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="command-shortcut"
      className={cn(
        `
          ml-auto text-xs tracking-widest text-muted-foreground
          group-data-selected/command-item:text-accent-foreground
        `,
        className,
      )}
      {...props}
    />
  )
}
