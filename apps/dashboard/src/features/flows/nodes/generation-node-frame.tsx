import type { FlowValueType } from '@talelabs/flows'
import type { ComponentType, ReactNode } from 'react'

import { FlowNodeOutputFooter } from './flow-node-output-footer'
import { FlowNodeShell } from './flow-node-shell'

export function GenerationNodeFrame({
  children,
  icon,
  modelName,
  nodeId,
  outputAriaLabel,
  outputHandleId,
  outputLabel,
  outputValueType,
  readiness,
  resolvedOperationId,
  selected,
  title,
}: {
  children: ReactNode
  icon: ComponentType<{ className?: string }>
  modelName: string
  nodeId: string
  outputAriaLabel: string
  outputHandleId: string
  outputLabel: string
  outputValueType: FlowValueType
  readiness: 'incomplete' | 'invalid' | 'ready'
  resolvedOperationId: null | string
  selected: boolean
  title: string
}) {
  return (
    <FlowNodeShell
      className="w-96"
      contentClassName="gap-0 p-0"
      footer={(
        <FlowNodeOutputFooter
          ariaLabel={outputAriaLabel}
          handleId={outputHandleId}
          label={outputLabel}
          valueType={outputValueType}
        />
      )}
      generationReadiness={readiness}
      icon={icon}
      nodeId={nodeId}
      selected={selected}
      title={title}
      titleMeta={modelName}
    >
      <div
        data-generation-node
        data-readiness={readiness}
        data-resolved-operation={resolvedOperationId ?? 'unresolved'}
      >
        {children}
      </div>
    </FlowNodeShell>
  )
}
