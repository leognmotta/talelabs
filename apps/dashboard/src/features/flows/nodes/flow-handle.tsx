import type { FlowValueType } from '@talelabs/flows'
import { IconPlus } from '@tabler/icons-react'
import { Handle, Position } from '@xyflow/react'

export function FlowHandle({
  ariaLabel,
  id,
  side,
  valueType,
}: {
  ariaLabel: string
  id: string
  side: 'input' | 'output'
  valueType: FlowValueType
}) {
  return (
    <Handle
      aria-label={ariaLabel}
      data-flow-handle
      data-side={side}
      data-value-type={valueType}
      id={id}
      position={side === 'input' ? Position.Left : Position.Right}
      type={side === 'input' ? 'target' : 'source'}
      className="
        flex! size-3.5! items-center! justify-center! border-2!
        border-(--flow-node-surface)! transition-transform
        data-connectionindicator:hover:scale-125
      "
      style={side === 'input'
        ? { left: 'calc(-0.75rem - 7px)' }
        : { right: 'calc(-0.75rem - 7px)' }}
    >
      <IconPlus
        aria-hidden
        className="pointer-events-none size-2.5 text-background"
        stroke={3}
      />
    </Handle>
  )
}
