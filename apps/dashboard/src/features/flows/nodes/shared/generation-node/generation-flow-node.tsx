/** Memoized generic audio generation node for dormant compatibility paths. */

import type {
  GenerationInputAvailability,
  GenerationInputSlotDefinition,
} from '@talelabs/flows'
import type { NodeProps } from '@xyflow/react'
import type { CanvasNode } from '../../../editor/flow-canvas-types'

import { IconMusic } from '@tabler/icons-react'
import {
  evaluateGenerationContract,
  getActiveGenerationInputSlots,
  getGenerationOperation,
} from '@talelabs/flows'
import { useNodeConnections } from '@xyflow/react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { useFlowCanvasRuntime } from '../../../editor/flow-canvas-runtime-context'
import { getCanvasGenerationModel } from '../../../generation/flow-generation-contract'
import { AudioWaveformPreview } from '../../audio/shared/audio-waveform-preview'
import { GenerationInputPort } from './generation-input-port'
import { GenerationInputRail } from './generation-input-rail'
import { GenerationNodeFrame } from './generation-node-frame'
import { GenerationNodePreviewArea } from './generation-node-preview-area'

/** Renders the memoized compatibility audio-generation node. */
export const GenerationFlowNode = memo(({
  data,
  id,
  selected,
  type,
}: NodeProps<CanvasNode>) => {
  const { t } = useTranslation()
  const runtime = useFlowCanvasRuntime()
  const incomingConnections = useNodeConnections({ handleType: 'target', id })
  const model = getCanvasGenerationModel({ data, type })
  const operation = model
    ? (getGenerationOperation(model, data.operationId)
      ?? getGenerationOperation(model, model.defaultOperationId))
    : undefined
  const activeSlots = model
    ? getActiveGenerationInputSlots(model, operation?.id)
    : []

  if (!model || !operation) {
    return null
  }

  function connectionCountFor(slot: GenerationInputSlotDefinition) {
    return incomingConnections.filter(
      connection => connection.targetHandle === slot.id,
    ).length
  }

  const connectionCounts = Object.fromEntries(
    activeSlots.map(slot => [slot.id, connectionCountFor(slot)]),
  )
  const itemCounts = Object.fromEntries(activeSlots.map((slot) => {
    return [
      slot.id,
      runtime.getExecutableInputCount(id, slot.id),
    ]
  }))
  const evaluation = evaluateGenerationContract({
    connectionCounts,
    itemCounts,
    model,
    operationId: operation.id,
    requireComplete: true,
    settings: data.settings ?? {},
  })

  function availabilityFor(
    slot: GenerationInputSlotDefinition,
  ): GenerationInputAvailability {
    const connectionCount = connectionCountFor(slot)
    if (connectionCount >= slot.maxConnections) {
      return { reasonKey: 'flows.audio.inputs.limitReached', state: 'full' }
    }
    return connectionCount > 0
      ? { connectionCount, itemCount: connectionCount, state: 'connected' }
      : { state: 'available' }
  }

  const incompleteIssueCodes = new Set([
    'generation_input_at_least_one',
    'generation_input_required',
    'generation_setting_required',
  ])
  const readiness = evaluation.issues.length === 0
    ? 'ready'
    : evaluation.issues.every(issue => incompleteIssueCodes.has(issue.code))
      ? 'incomplete'
      : 'invalid'
  const outputLabel = t('flows.outputs.audio')

  return (
    <GenerationNodeFrame
      icon={IconMusic}
      modelName={t(model.labelKey)}
      nodeId={id}
      outputAriaLabel={t('flows.handles.output', { output: outputLabel })}
      outputHandleId="audio"
      outputLabel={outputLabel}
      outputValueType="AudioSet"
      readiness={readiness}
      resolvedOperationId={operation.id}
      selected={selected}
      title={t('flows.nodes.audioGeneration')}
    >
      <GenerationNodePreviewArea>
        <GenerationInputRail ariaLabel={t('flows.audio.inputs.railLabel')}>
          {activeSlots.map((slot) => {
            const connectionCount = connectionCountFor(slot)
            const availability = availabilityFor(slot)
            const label = t(slot.labelKey)
            const reason = availability.state === 'full'
              ? t(availability.reasonKey)
              : t(slot.descriptionKey)

            return (
              <GenerationInputPort
                ariaLabel={t('flows.handles.input', { input: label })}
                availability={availability}
                connectionCount={connectionCount}
                key={slot.id}
                label={label}
                reason={reason}
                slot={slot}
              />
            )
          })}
        </GenerationInputRail>
        <AudioWaveformPreview
          ariaLabel={t('flows.audio.preview.label')}
          readiness={readiness}
          readinessMessage={t(`flows.audio.readiness.${readiness}`)}
          resolvedOperationId={operation.id}
        />
      </GenerationNodePreviewArea>
    </GenerationNodeFrame>
  )
})
