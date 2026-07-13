import type { ComponentType, ReactNode } from 'react'
import { cn } from '@talelabs/ui/lib/utils'
import { FlowNodeToolbar } from '../flow-node-toolbar'

export function FlowNodeShell({
  children,
  className,
  footer,
  headerAction,
  icon: Icon,
  nodeId,
  selected,
  title,
}: {
  children: ReactNode
  className?: string
  footer?: ReactNode
  headerAction?: ReactNode
  icon: ComponentType<{ className?: string }>
  nodeId: string
  selected: boolean
  title: string
}) {
  return (
    <>
      <FlowNodeToolbar nodeId={nodeId} />
      <div
        data-flow-node-shell
        data-selected={selected}
        className={cn(
          `
            w-80 overflow-visible rounded-xl border border-border/90 bg-card
            text-card-foreground shadow-[0_12px_32px_rgb(0_0_0/0.22)]
            transition-[border-color,box-shadow]
            data-[selected=true]:border-primary/80
            data-[selected=true]:shadow-[0_0_0_1px_var(--primary),0_16px_40px_rgb(0_0_0/0.3)]
          `,
          className,
        )}
      >
        <div
          className="
            flex h-10 cursor-default items-center gap-2 border-b
            border-border/70 px-3
            active:cursor-grabbing
          "
        >
          <Icon className="size-3.5 shrink-0 text-muted-foreground" />
          <span
            className="min-w-0 flex-1 truncate text-[13px] font-semibold"
            title={title}
          >
            {title}
          </span>
          {headerAction}
        </div>
        <div className="flex flex-col gap-2.5 p-3">{children}</div>
        {footer
          ? (
              <div className="relative border-t border-border/70 px-3 py-2">
                {footer}
              </div>
            )
          : null}
      </div>
    </>
  )
}
