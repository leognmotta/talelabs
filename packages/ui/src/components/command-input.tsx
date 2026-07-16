import { IconLoader2, IconSearch } from '@tabler/icons-react'
import {
  InputGroup,
  InputGroupAddon,
} from '@talelabs/ui/components/input-group'
import { cn } from '@talelabs/ui/lib/utils'
import { Command as CommandPrimitive } from 'cmdk'
import * as React from 'react'

export function CommandInput({
  className,
  loading = false,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Input> & {
  loading?: boolean
}) {
  return (
    <div data-slot="command-input-wrapper" className="p-1 pb-0">
      <InputGroup className="h-9" variant="outline">
        <CommandPrimitive.Input
          data-slot="command-input"
          className={cn(
            `
              w-full text-sm outline-hidden
              disabled:cursor-not-allowed disabled:opacity-50
            `,
            className,
          )}
          aria-busy={loading}
          {...props}
        />
        <InputGroupAddon>
          <IconSearch className="size-4 shrink-0 opacity-50" />
        </InputGroupAddon>
        {loading && (
          <InputGroupAddon align="inline-end">
            <IconLoader2
              aria-hidden
              className="
                size-4 animate-spin opacity-60
                motion-reduce:animate-none
              "
            />
          </InputGroupAddon>
        )}
      </InputGroup>
    </div>
  )
}

export function CommandList({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      data-slot="command-list"
      className={cn(
        `
          no-scrollbar max-h-72 scroll-py-1 overflow-x-hidden overflow-y-auto
          outline-none
        `,
        className,
      )}
      {...props}
    />
  )
}

export function CommandEmpty({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      data-slot="command-empty"
      className={cn('py-6 text-center text-sm', className)}
      {...props}
    />
  )
}
