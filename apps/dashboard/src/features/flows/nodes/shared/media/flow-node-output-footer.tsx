/** Output handle footer with canonical value type and collection count. */

import type { FlowValueType } from '@talelabs/flows'
import type { ReactNode } from 'react'

import { FlowHandle } from '../ports/flow-handle'

/** Displays output identity and optional status beneath a node preview. */
export function FlowNodeOutputFooter({
  action,
  ariaLabel,
  children,
  handleId,
  label,
  showLabel = true,
  valueType,
}: {
  /** Right-aligned control placed just before the output handle (e.g. Run). */
  action?: ReactNode
  ariaLabel: string
  children?: ReactNode
  handleId: string
  label: string
  /**
   * Whether to render the text output label. The handle's tooltip, icon, and
   * type color already identify the output, so nodes that lead with an action
   * (generation Run) hide the redundant label.
   */
  showLabel?: boolean
  valueType: FlowValueType
}) {
  return (
    <div
      className="
        relative flex min-h-6 w-full items-center gap-3 text-[11px]
        text-muted-foreground
      "
    >
      {children}
      <div className="relative ml-auto flex items-center gap-2">
        {action}
        {showLabel && <span>{label}</span>}
        <FlowHandle
          ariaLabel={ariaLabel}
          id={handleId}
          side="output"
          tooltip={label}
          valueType={valueType}
        />
      </div>
    </div>
  )
}
