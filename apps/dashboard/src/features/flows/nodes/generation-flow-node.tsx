import type {
  FlowValueType,
  GenerationInputSlotDefinition,
  GenerationNodeType,
} from '@talelabs/flows'
import type { NodeProps } from '@xyflow/react'
import type { CanvasNode } from '../flow-canvas-types'
/* eslint-disable better-tailwindcss/no-unknown-classes -- React Flow uses these interaction classes as behavior hooks. */

import {
  IconAspectRatio,
  IconMusic,
  IconPhotoSpark,
  IconPlayerPlay,
  IconVideo,
} from '@tabler/icons-react'
import {
  getActiveGenerationInputSlots,
  getGenerationOperation,
  isGenerationNodeType,
} from '@talelabs/flows'
import { cn } from '@talelabs/ui/lib/utils'
import { useNodeConnections, useUpdateNodeInternals } from '@xyflow/react'
import { memo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useFlowCanvas } from '../flow-canvas-context'
import { getCanvasGenerationModel } from '../flow-generation-contract'
import { FlowHandle } from './flow-handle'
import { FlowNodeShell } from './flow-node-shell'

const NODE_PRESENTATION = {
  audioGeneration: {
    icon: IconMusic,
    mediaType: 'audio',
    outputHandleId: 'audio',
    outputLabelKey: 'flows.outputs.audio',
    outputValueType: 'AudioSet',
  },
  imageGeneration: {
    icon: IconPhotoSpark,
    mediaType: 'image',
    outputHandleId: 'images',
    outputLabelKey: 'flows.outputs.images',
    outputValueType: 'ImageSet',
  },
  videoGeneration: {
    icon: IconVideo,
    mediaType: 'video',
    outputHandleId: 'videos',
    outputLabelKey: 'flows.outputs.videos',
    outputValueType: 'VideoSet',
  },
} as const satisfies Record<GenerationNodeType, {
  icon: typeof IconPhotoSpark
  mediaType: 'audio' | 'image' | 'video'
  outputHandleId: string
  outputLabelKey: string
  outputValueType: FlowValueType
}>

function getNodePresentation(type: CanvasNode['type']) {
  if (!isGenerationNodeType(type))
    throw new Error(`Unsupported generation node type: ${type}`)
  return NODE_PRESENTATION[type]
}

function parseAspectRatio(value: unknown) {
  const label = typeof value === 'string' ? value : '1:1'
  const [width, height] = label.split(':').map(Number)
  return {
    label,
    value: width && height ? width / height : 1,
  }
}

export const GenerationFlowNode = memo(({
  data,
  id,
  selected,
  type,
}: NodeProps<CanvasNode>) => {
  const { t } = useTranslation()
  const canvas = useFlowCanvas()
  const updateNodeInternals = useUpdateNodeInternals()
  const incomingConnections = useNodeConnections({ handleType: 'target', id })
  const presentation = getNodePresentation(type)
  const model = getCanvasGenerationModel({ data, type })
  const operation = model
    ? getGenerationOperation(model, data.operationId)
    ?? getGenerationOperation(model, model.defaultOperationId)
    : undefined
  const activeSlots = model
    ? getActiveGenerationInputSlots(model, operation?.id)
    : []
  const aspectRatio = parseAspectRatio(data.settings?.aspectRatio)
  const Icon = presentation.icon

  useEffect(() => {
    const frame = requestAnimationFrame(() => updateNodeInternals(id))
    return () => cancelAnimationFrame(frame)
  }, [data.modelContractVersion, id, model?.id, operation?.id, updateNodeInternals])

  function renderInputPort(slot: GenerationInputSlotDefinition) {
    const inputState = canvas.getInputState(id, slot.id)
    const connectionCount = incomingConnections.filter(
      connection => connection.targetHandle === slot.id,
    ).length
    const isReferenceInput = slot.accepts.some(valueType => (
      valueType === 'ImageSet'
      || valueType === 'VideoSet'
      || valueType === 'AudioSet'
    ))
    const status = inputState?.invalid
      ? t('flows.inputStates.invalid')
      : isReferenceInput
        ? connectionCount === 0
          ? t('flows.inputStates.unconnected')
          : t(inputState?.mode === 'manual'
              ? 'flows.inputStates.customized'
              : 'flows.inputStates.automatic', {
              available: inputState?.availableCount ?? 0,
              count: inputState?.selectedAvailableCount ?? 0,
            })
        : t('flows.inputStates.connections', { count: connectionCount })
    const compactStatus = isReferenceInput
      ? connectionCount
        ? `${inputState?.selectedAvailableCount ?? 0}/${inputState?.availableCount ?? 0}`
        : null
      : connectionCount
        ? String(connectionCount)
        : null
    const content = (
      <>
        <span className="font-medium text-foreground">{t(slot.labelKey)}</span>
        {compactStatus && (
          <span className={inputState?.invalid
            ? 'text-destructive'
            : `text-muted-foreground`}
          >
            {compactStatus}
          </span>
        )}
      </>
    )

    return (
      <div className="relative h-12 w-0" key={slot.id}>
        <FlowHandle
          ariaLabel={t('flows.handles.input', { input: t(slot.labelKey) })}
          id={slot.id}
          side="input"
          valueType={slot.accepts[0]}
        />
        {isReferenceInput
          ? (
              <button
                aria-label={`${t(slot.labelKey)}: ${status}`}
                data-flow-port-tag
                className="
                  nodrag nopan absolute right-5 bottom-[calc(50%+1rem)] z-20
                  flex items-center gap-1.5 rounded-md border border-border/80
                  bg-card/96 px-2 py-1 text-[11px] whitespace-nowrap
                  shadow-[0_8px_24px_rgb(0_0_0/0.24)] backdrop-blur-sm
                  transition-[color,background-color,border-color,opacity]
                  outline-none
                  hover:bg-muted
                  focus-visible:ring-2 focus-visible:ring-ring
                "
                title={status}
                type="button"
                onClick={() => canvas.openInputInspector(id, slot.id)}
              >
                {content}
              </button>
            )
          : (
              <div
                data-flow-port-tag
                className="
                  absolute right-5 bottom-[calc(50%+1rem)] z-20 flex
                  items-center gap-1.5 rounded-md border border-border/80
                  bg-card/96 px-2 py-1 text-[11px] whitespace-nowrap
                  shadow-[0_8px_24px_rgb(0_0_0/0.24)] backdrop-blur-sm
                  transition-opacity
                "
                title={status}
              >
                {content}
              </div>
            )}
      </div>
    )
  }

  return (
    <FlowNodeShell
      className="w-120"
      icon={Icon}
      nodeId={id}
      selected={selected}
      title={model ? t(model.labelKey) : t(`flows.nodes.${type}`)}
    >
      {model && operation
        ? (
            <div className="relative">
              <div className="
                absolute inset-y-0 left-0 z-10 flex flex-col justify-center
                gap-3
              "
              >
                {activeSlots.map(renderInputPort)}
              </div>

              <div className="flex flex-col gap-2">
                <div className="
                  relative flex aspect-4/3 items-center justify-center
                  overflow-hidden rounded-lg border border-border/70
                  bg-background p-3 shadow-inner
                "
                >
                  {presentation.mediaType === 'audio'
                    ? (
                        <div
                          data-flow-output-preview
                          className="
                            flex h-24 w-full items-center justify-center gap-1
                            rounded-lg border border-border/55 px-8
                          "
                        >
                          {Array.from({ length: 36 }, (_, index) => (
                            <span
                              className="
                                w-1 rounded-full bg-muted-foreground/35
                              "
                              key={index}
                              style={{ height: `${18 + ((index * 17) % 62)}%` }}
                            />
                          ))}
                        </div>
                      )
                    : (
                        <div
                          data-flow-output-preview
                          className={cn(
                            `
                              relative max-h-full max-w-full rounded-lg border
                              border-border/55
                            `,
                            aspectRatio.value >= 1 ? 'w-full' : 'h-full',
                          )}
                          style={{ aspectRatio: aspectRatio.value }}
                        >
                          {presentation.mediaType === 'video' && (
                            <IconPlayerPlay
                              aria-hidden
                              className="
                                absolute top-1/2 left-1/2 size-8 -translate-1/2
                                text-muted-foreground/55
                              "
                            />
                          )}
                        </div>
                      )}
                </div>
                <div className="flex h-7 items-center justify-end px-1">
                  {presentation.mediaType !== 'audio' && (
                    <span className="
                      flex items-center gap-1.5 text-[11px]
                      text-muted-foreground
                    "
                    >
                      <IconAspectRatio aria-hidden className="size-4" />
                      {aspectRatio.label}
                    </span>
                  )}
                </div>
              </div>

              <div className="
                absolute top-1/2 right-0 h-12 w-0 -translate-y-1/2
              "
              >
                <FlowHandle
                  ariaLabel={t('flows.handles.output', {
                    output: t(presentation.outputLabelKey),
                  })}
                  id={presentation.outputHandleId}
                  side="output"
                  valueType={presentation.outputValueType}
                />
                <span
                  data-flow-port-tag
                  className="
                    absolute bottom-[calc(50%+1rem)] left-5 z-20 rounded-md
                    border border-border/80 bg-card/96 px-2 py-1 text-[11px]
                    font-medium whitespace-nowrap text-foreground
                    shadow-[0_8px_24px_rgb(0_0_0/0.24)] backdrop-blur-sm
                    transition-opacity
                  "
                >
                  {t(presentation.outputLabelKey)}
                </span>
              </div>
            </div>
          )
        : <p className="text-sm text-destructive">{t('flows.modelUnavailable')}</p>}
    </FlowNodeShell>
  )
})
