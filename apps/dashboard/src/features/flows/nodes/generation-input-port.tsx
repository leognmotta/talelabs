import type {
  GenerationInputAvailability,
  GenerationInputSlotDefinition,
} from '@talelabs/flows'
import type { ComponentProps, ReactNode } from 'react'

import { cn } from '@talelabs/ui/lib/utils'
import { FlowHandle } from './flow-handle'

export function GenerationInputPort({
  ariaLabel,
  availability,
  children,
  className,
  connectionCount,
  label,
  nodeEdge = true,
  reason,
  showConnectionCount = true,
  slot,
  ...props
}: Omit<ComponentProps<'div'>, 'children' | 'slot'> & {
  ariaLabel: string
  availability: GenerationInputAvailability
  children?: ReactNode
  connectionCount: number
  label: string
  nodeEdge?: boolean
  reason: string
  showConnectionCount?: boolean
  slot: GenerationInputSlotDefinition
}) {
  const disabled = availability.state === 'blocked' || availability.state === 'full'

  return (
    <div
      {...props}
      className={cn(
        'relative flex h-12 items-center',
        availability.state === 'blocked' && 'opacity-45',
        className,
      )}
      data-generation-input-port={slot.id}
      data-input-state={availability.state}
    >
      <FlowHandle
        ariaLabel={`${ariaLabel}. ${reason}`}
        connectionCount={connectionCount}
        disabled={disabled}
        id={slot.id}
        nodeEdge={nodeEdge}
        showConnectionCount={showConnectionCount}
        side="input"
        tooltip={label}
        valueType={slot.accepts[0]!}
      />
      {children}
    </div>
  )
}
