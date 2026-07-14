import type { FlowValueType } from '@talelabs/flows'
import type { ReactNode } from 'react'

import { FlowHandle } from './flow-handle'

export function FlowNodeOutputFooter({
  ariaLabel,
  children,
  handleId,
  label,
  valueType,
}: {
  ariaLabel: string
  children?: ReactNode
  handleId: string
  label: string
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
        <span>{label}</span>
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
