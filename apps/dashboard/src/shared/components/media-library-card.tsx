import type { ReactNode } from 'react'

import { Skeleton } from '@talelabs/ui/components/skeleton'
import { cn } from '@talelabs/ui/lib/utils'

export function MediaLibraryGrid({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(`
        grid grid-cols-2 gap-x-4 gap-y-6
        sm:grid-cols-3
        lg:grid-cols-4
        xl:grid-cols-5
        2xl:grid-cols-6
      `, className)}
    >
      {children}
    </div>
  )
}

export function MediaLibraryCardPreview({
  children,
  className,
  selected = false,
}: {
  children: ReactNode
  className?: string
  selected?: boolean
}) {
  return (
    <div
      className={cn(
        `
          relative aspect-square overflow-hidden rounded-xl bg-muted/60 ring-1
          ring-border transition
        `,
        selected && 'ring-2 ring-primary',
        className,
      )}
      data-slot="media-library-card-preview"
    >
      {children}
    </div>
  )
}

export function MediaLibraryCardDetails({
  children,
  trailing,
}: {
  children: ReactNode
  trailing?: ReactNode
}) {
  return (
    <div className="mt-2 flex min-w-0 items-start gap-2 px-0.5">
      <div className="min-w-0 flex-1">{children}</div>
      {trailing}
    </div>
  )
}

export function MediaLibrarySkeleton() {
  return (
    <MediaLibraryGrid className="gap-y-4 py-5">
      {Array.from({ length: 10 }, (_, index) => (
        <div className="flex flex-col gap-2" key={index}>
          <Skeleton className="aspect-square w-full rounded-xl" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-3 w-2/5" />
        </div>
      ))}
    </MediaLibraryGrid>
  )
}
