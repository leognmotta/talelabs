/** Shared node frame with selection and keyed generation-run presentation. */

import type { FlowValueType } from '@talelabs/flows'
import type { ComponentType, CSSProperties, ReactNode } from 'react'

import { IconLock } from '@tabler/icons-react'
import { BorderBeam } from '@talelabs/ui/components/border-beam'
import { cn } from '@talelabs/ui/lib/utils'
import { useTranslation } from 'react-i18next'
import { useCanvasStore } from '../../editor/canvas-state/canvas-store-context'
import { useFlowGenerationPreview } from '../../editor/flow-canvas-runtime-context'

/** Accent color token per graph value type; the node's only color accent. */
const FLOW_ACCENT_TOKEN: Record<FlowValueType, string> = {
  Asset: 'var(--flow-type-asset)',
  AudioSet: 'var(--flow-type-audio)',
  ImageSet: 'var(--flow-type-image)',
  Text: 'var(--flow-type-text)',
  VideoSet: 'var(--flow-type-video)',
}

/** Renders the shared visual shell and keyed pending state for one node. */
export function FlowNodeShell({
  accentValueType,
  children,
  className,
  contentClassName,
  footer,
  headerAction,
  icon: Icon,
  nodeId,
  selected,
  title,
  titleMeta,
}: {
  /** Output value type driving the node's single color accent, when known. */
  accentValueType?: FlowValueType
  children: ReactNode
  className?: string
  contentClassName?: string
  footer?: ReactNode
  headerAction?: ReactNode
  icon: ComponentType<{ className?: string }>
  nodeId: string
  selected: boolean
  title: string
  titleMeta?: string
}) {
  const { t } = useTranslation()
  const fullTitle = titleMeta ? `${title} · ${titleMeta}` : title
  const running = useFlowGenerationPreview(nodeId)?.status === 'pending'
  const locked = useCanvasStore(
    state => state.nodes.find(node => node.id === nodeId)?.data.locked === true,
  )
  const accentStyle = accentValueType
    ? { '--flow-node-accent': FLOW_ACCENT_TOKEN[accentValueType] } as CSSProperties
    : undefined

  return (
    <div
      data-accent={accentValueType}
      data-flow-node-shell
      data-running={running}
      data-selected={selected}
      style={accentStyle}
      className={cn(
        `
          relative w-80 overflow-visible rounded-xl border bg-card
          text-card-foreground shadow-(--flow-shadow-node)
          transition-[border-color,box-shadow] duration-(--flow-motion-fast)
          ease-(--flow-motion-ease)
        `,
        running
          ? `
            border-transparent
            shadow-[0_0_24px_color-mix(in_oklab,var(--flow-node-accent,var(--primary))_30%,transparent),var(--flow-shadow-node-selected)]
          `
          : selected
            ? `
              border-primary/80
              shadow-[0_0_0_1px_var(--primary),var(--flow-shadow-node-selected)]
            `
            : `
              border-border/90
              hover:border-border hover:shadow-(--flow-shadow-node-selected)
            `,
        className,
      )}
    >
      <div
        className="
          flex h-10 cursor-default items-center gap-2 border-b border-border/50
          px-3
          active:cursor-grabbing
        "
      >
        <Icon className="size-3.5 shrink-0" data-flow-node-icon="" />
        <span
          className="min-w-0 flex-1 truncate text-[13px]"
          title={fullTitle}
        >
          <span className="font-medium">{title}</span>
          {titleMeta
            ? (
                <span className="font-normal text-muted-foreground">
                  <span aria-hidden> · </span>
                  {titleMeta}
                </span>
              )
            : null}
        </span>
        {locked
          ? (
              <IconLock
                aria-label={t('flows.nodeLocked')}
                className="size-3.5 shrink-0 text-muted-foreground"
                role="img"
              />
            )
          : null}
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
            <div className="relative border-t border-border/50 px-3 py-2">
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
  )
}
