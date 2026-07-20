/** Shared generation node shell that keeps header, inputs, preview, and footer aligned. */

import type { FlowValueType } from '@talelabs/flows'
import type { ComponentType, ReactNode } from 'react'

import { FlowNodeShell } from '../flow-node-shell'
import { FlowNodeOutputFooter } from '../media/flow-node-output-footer'
import { GenerationRunControls } from './generation-run-controls'

/** Composes the common generation shell, input rail, prompt, preview, and run footer. */
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
      accentValueType={outputValueType}
      className="w-96"
      contentClassName="gap-0 p-0"
      footer={(
        <FlowNodeOutputFooter
          action={(
            <GenerationRunControls
              canRun={readiness === 'ready'}
              nodeId={nodeId}
            />
          )}
          ariaLabel={outputAriaLabel}
          handleId={outputHandleId}
          label={outputLabel}
          showLabel={false}
          valueType={outputValueType}
        />
      )}
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
