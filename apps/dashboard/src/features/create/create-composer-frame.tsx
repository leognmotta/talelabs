/**
 * Shared visual frame for direct Create composer presentations.
 *
 * The full Create workspace and compact Project Home entry point compose their
 * own controls inside this one product-owned surface.
 */

import type { ComponentProps } from 'react'

import { cn } from '@talelabs/ui/lib/utils'

/** Renders the canonical direct Create form surface around composed controls. */
export function CreateComposerFrame({
  className,
  ...props
}: ComponentProps<'form'>) {
  return (
    <form
      className={cn(
        `
          overflow-hidden rounded-[1.375rem] border border-border/80 bg-card/95
          shadow-[0_24px_80px_rgb(0_0_0/0.34)]
        `,
        className,
      )}
      {...props}
    />
  )
}
