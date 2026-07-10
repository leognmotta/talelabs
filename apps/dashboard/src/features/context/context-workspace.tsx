import type { ReactNode } from 'react'

import { cn } from '@talelabs/ui/lib/utils'

export function ContextWorkspace({
  detail,
  isDetailOpen,
  sidebar,
}: {
  detail: ReactNode
  isDetailOpen: boolean
  sidebar: ReactNode
}) {
  return (
    <div className="
      min-h-[calc(100svh-7.0625rem)] overflow-hidden border bg-background
      md:grid md:grid-cols-[20rem_minmax(0,1fr)]
    "
    >
      <aside
        className={cn(
          'min-w-0 border-r bg-muted/15',
          isDetailOpen && `
            hidden
            md:block
          `,
        )}
      >
        {sidebar}
      </aside>
      <div
        className={cn(
          'min-w-0 bg-background',
          !isDetailOpen && `
            hidden
            md:block
          `,
        )}
      >
        {detail}
      </div>
    </div>
  )
}
