/** Preview state switch for pending, failed, empty, and retained generation output. */

import type { FlowValueType } from '@talelabs/flows'
import type { ComponentProps, ReactNode } from 'react'

import { FlowNodePreviewStage } from '../media/flow-node-preview-stage'

type GenerationOutputValueType = Extract<
  FlowValueType,
  'AudioSet' | 'ImageSet' | 'Text' | 'VideoSet'
>

/** Selects pending, error, empty, or successful output content for a generation node. */
export function GenerationPreviewStage({
  children,
  className,
  readiness,
  readinessMessage: _readinessMessage,
  valueType,
  ...props
}: Omit<ComponentProps<'div'>, 'children'> & {
  aspectRatio?: number
  children: ReactNode
  readiness: 'incomplete' | 'invalid' | 'ready'
  readinessMessage: string
  valueType: GenerationOutputValueType
}) {
  return (
    <FlowNodePreviewStage
      {...props}
      className={className}
      data-generation-preview-stage
      data-readiness={readiness}
      valueType={valueType}
    >
      {children}
    </FlowNodePreviewStage>
  )
}
