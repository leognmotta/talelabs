import type { NodeProps } from '@xyflow/react'
import type { CanvasNode } from '../../flow-canvas-types'

import { IconSparkles } from '@tabler/icons-react'
import { useNodeConnections } from '@xyflow/react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { FlowNodeShell } from '../flow-node-shell'
import { GenerationNodeFrame } from '../generation-node-frame'
import { GenerationNodePreviewArea } from '../generation-node-preview-area'
import { GenerationNodePromptSection } from '../generation-node-prompt-section'
import { LlmInputRail } from './llm-input-rail'
import { LlmOutputPreview } from './llm-output-preview'
import { LlmPrompt } from './llm-prompt'
import { useLlmNode } from './use-llm-node'

export const LlmFlowNode = memo(({
  data,
  id,
  selected,
  type,
}: NodeProps<CanvasNode>) => {
  const { t } = useTranslation()
  const incomingConnections = useNodeConnections({ handleType: 'target', id })
  const node = { data, id, type }
  const llm = useLlmNode({ incomingConnections, node })

  if (!llm.model || !llm.resolution) {
    return (
      <FlowNodeShell
        className="w-96"
        icon={IconSparkles}
        nodeId={id}
        selected={selected}
        title={t('flows.nodes.llm')}
      >
        <p className="text-sm text-destructive">{t('flows.modelUnavailable')}</p>
      </FlowNodeShell>
    )
  }

  const readinessMessageKey = llm.resolution.issues.find(
    issue => issue.messageKey,
  )?.messageKey ?? `flows.llm.readiness.${llm.resolution.readiness}`
  const promptSlot = llm.model.inputSlots.find(slot => slot.id === 'prompt')
  const promptAvailability = promptSlot
    ? llm.resolution.inputAvailability[promptSlot.id]
    : undefined
  const promptInput = promptSlot
    && promptAvailability
    && promptAvailability.state !== 'unsupported'
    ? {
        availability: promptAvailability,
        inputState: llm.inputState(promptSlot),
        slot: promptSlot,
      }
    : undefined

  const outputLabel = t('flows.outputs.text')

  return (
    <GenerationNodeFrame
      icon={IconSparkles}
      modelName={t(llm.model.labelKey)}
      nodeId={id}
      outputAriaLabel={t('flows.handles.output', { output: outputLabel })}
      outputHandleId="text"
      outputLabel={outputLabel}
      outputValueType="Text"
      readiness={llm.resolution.readiness}
      resolvedOperationId={llm.resolution.resolvedOperationId}
      selected={selected}
      title={t('flows.nodes.llm')}
    >
      <GenerationNodePreviewArea>
        <LlmInputRail
          ariaLabel={t('flows.llm.inputs.railLabel')}
          inputState={llm.inputState}
          resolution={llm.resolution}
          slots={llm.model.inputSlots}
        />
        <LlmOutputPreview
          currentFingerprint={llm.previewFingerprint}
          preview={llm.preview}
          readiness={llm.resolution.readiness}
          readinessMessageKey={readinessMessageKey}
          onOpen={llm.openOutputInspector}
        />
      </GenerationNodePreviewArea>
      <GenerationNodePromptSection>
        <LlmPrompt
          externalPromptConnected={llm.externalPromptConnected}
          helpId={`llm-prompt-external-help-${id}`}
          input={promptInput}
          prompt={String(data.prompt ?? '')}
          onPromptChange={llm.updatePrompt}
        />
      </GenerationNodePromptSection>
    </GenerationNodeFrame>
  )
})
