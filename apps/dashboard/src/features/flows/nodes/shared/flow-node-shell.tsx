/** Shared node frame with selection and keyed generation-run presentation. */

import type { ComponentType, ReactNode } from 'react'

import { BorderBeam } from '@talelabs/ui/components/border-beam'
import { cn } from '@talelabs/ui/lib/utils'
import { useFlowGenerationPreview } from '../../editor/flow-canvas-runtime-context'
import { FlowNodeToolbar } from './toolbars/flow-node-toolbar'

/** Renders the shared visual shell and keyed pending state for one node. */
export function FlowNodeShell({
  children,
  className,
  contentClassName,
  footer,
  headerAction,
  icon: Icon,
  generationReadiness,
  nodeId,
  selected,
  title,
  titleMeta,
}: {
  children: ReactNode
  className?: string
  contentClassName?: string
  footer?: ReactNode
  generationReadiness?: 'incomplete' | 'invalid' | 'ready'
  headerAction?: ReactNode
  icon: ComponentType<{ className?: string }>
  nodeId: string
  selected: boolean
  title: string
  titleMeta?: string
}) {
  const fullTitle = titleMeta ? `${title} · ${titleMeta}` : title
  const running = useFlowGenerationPreview(nodeId)?.status === 'pending'

  return (
    <>
      <FlowNodeToolbar
        generationReadiness={generationReadiness}
        nodeId={nodeId}
      />
      <div
        data-flow-node-shell
        data-running={running}
        data-selected={selected}
        className={cn(
          `
            relative w-80 overflow-visible rounded-xl border bg-card
            text-card-foreground shadow-[0_12px_32px_rgb(0_0_0/0.22)]
            transition-[border-color,box-shadow]
          `,
          running
            ? `
              border-transparent
              shadow-[0_0_30px_color-mix(in_oklab,var(--flow-type-video)_38%,transparent),0_16px_42px_rgb(0_0_0/0.32)]
            `
            : selected
              ? `
                border-primary/80
                shadow-[0_0_0_1px_var(--primary),0_16px_40px_rgb(0_0_0/0.3)]
              `
              : 'border-border/90',
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
            className="min-w-0 flex-1 truncate text-[13px]"
            title={fullTitle}
          >
            <span className="font-semibold">{title}</span>
            {titleMeta
              ? (
                  <span className="font-normal text-muted-foreground">
                    <span aria-hidden> · </span>
                    {titleMeta}
                  </span>
                )
              : null}
          </span>
          {headerAction}
        </div>
        <div
          className={cn(
            'flex flex-col gap-2.5 p-3',
            !footer && 'overflow-hidden rounded-b-[calc(var(--radius-xl)-1px)]',
            contentClassName,
          )}
          data-flow-node-content
          data-terminal={!footer || undefined}
        >
          {children}
        </div>
        {footer
          ? (
              <div className="relative border-t border-border/70 px-3 py-2">
                {footer}
              </div>
            )
          : null}
        {running
          ? (
              <>
                <BorderBeam
                  borderWidth={2.5}
                  className="
                    from-transparent via-(--flow-type-image)
                    to-(--flow-type-video)
                  "
                  colorFrom="var(--flow-type-image)"
                  colorTo="var(--flow-type-video)"
                  duration={3.4}
                  size={360}
                />
                <BorderBeam
                  borderWidth={2}
                  className="
                    from-transparent via-(--flow-type-audio) to-(--primary)
                    opacity-75
                  "
                  colorFrom="var(--flow-type-audio)"
                  colorTo="var(--primary)"
                  delay={1.7}
                  duration={3.4}
                  reverse
                  size={260}
                />
              </>
            )
          : null}
      </div>
    </>
  )
}
