import type { FlowValueType } from '@talelabs/flows'
import type { ComponentProps, ReactNode } from 'react'

import { cn } from '@talelabs/ui/lib/utils'

export function FlowNodePreviewStage({
  aspectRatio,
  children,
  className,
  style,
  valueType,
  ...props
}: Omit<ComponentProps<'div'>, 'children'> & {
  aspectRatio?: number
  children: ReactNode
  valueType: FlowValueType
}) {
  return (
    <div
      {...props}
      className={cn(
        'relative w-full overflow-hidden',
        aspectRatio === undefined ? 'min-h-72' : 'min-h-0',
        className,
      )}
      data-flow-node-preview-stage
      data-value-type={valueType}
      style={aspectRatio === undefined
        ? style
        : { ...style, aspectRatio }}
    >
      {children}
    </div>
  )
}
