import type { FlowHandleDefinition, FlowValueType } from '@talelabs/flows'
import type { TFunction } from 'i18next'
import type { CanvasEdge, CanvasNode } from './flow-canvas-types'
/* eslint-disable better-tailwindcss/no-unknown-classes -- React Flow uses these interaction classes as behavior hooks. */

import { IconArrowDownToArc, IconArrowUpToArc } from '@tabler/icons-react'
import {
  getElementAssetRoles,
  getElementTypeDefinition,
} from '@talelabs/elements'
import { getFlowNodeHandles, isGenerationNodeType } from '@talelabs/flows'
import { Badge } from '@talelabs/ui/components/badge'
import { Button } from '@talelabs/ui/components/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@talelabs/ui/components/card'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@talelabs/ui/components/hover-card'
import { useTranslation } from 'react-i18next'
import { useFlowCanvas } from './flow-canvas-context'
import { canvasNodeToGraphNode } from './flow-canvas-serialization'
import { FLOW_DASHBOARD_NODE_REGISTRY } from './flow-dashboard-node-registry'
import { getCanvasGenerationModel } from './flow-generation-contract'

function valueTypeLabel(valueType: FlowValueType, t: TFunction) {
  const keys = {
    Asset: 'flows.outputs.asset',
    AudioSet: 'assets.types.audio',
    ElementContext: 'flows.outputs.elementContext',
    ImageSet: 'assets.types.image',
    Text: 'flows.outputs.text',
    VideoSet: 'assets.types.video',
  } as const
  return t(keys[valueType])
}

function handleLabel(
  handle: FlowHandleDefinition,
  node: CanvasNode,
  t: TFunction,
  canvas: ReturnType<typeof useFlowCanvas>,
) {
  if (isGenerationNodeType(node.type)) {
    const model = getCanvasGenerationModel(node)
    const slot = model?.inputSlots.find(item => item.id === handle.id)
    if (slot)
      return t(slot.labelKey)
  }

  if (handle.id === 'asset')
    return t('flows.outputs.asset')
  if (handle.id === 'context')
    return t('flows.outputs.elementContext')
  if (handle.id === 'images')
    return t('flows.outputs.images')
  if (handle.id === 'videos')
    return t('flows.outputs.videos')
  if (handle.id === 'audio')
    return t('flows.outputs.audio')
  if (handle.id === 'text')
    return t('flows.outputs.text')

  if (handle.id.startsWith('role:') && node.elementId) {
    const element = canvas.referenceData.elementsById.get(node.elementId)
    if (element) {
      const roleId = handle.id.slice('role:'.length)
      const role = getElementAssetRoles(element.type, element.data)
        .find(item => item.id === roleId)
      if (role) {
        const fixed = getElementTypeDefinition(element.type).assetRoles.some(item => item.id === role.id)
        return fixed
          ? t(`elements.types.${element.type}.assetRoles.${role.id}.label`)
          : role.id
      }
    }
  }

  return handle.id
}

function connectedNodeName(
  node: CanvasNode,
  t: TFunction,
  canvas: ReturnType<typeof useFlowCanvas>,
) {
  if (node.type === 'asset' && node.assetId) {
    return canvas.referenceData.assetsById.get(node.assetId)?.name
      ?? t('flows.nodes.asset')
  }
  if (node.type === 'element' && node.elementId) {
    return canvas.referenceData.elementsById.get(node.elementId)?.name
      ?? t('flows.nodes.element')
  }
  if (isGenerationNodeType(node.type)) {
    const model = getCanvasGenerationModel(node)
    return model ? t(model.labelKey) : t(`flows.nodes.${node.type}`)
  }
  return t(FLOW_DASHBOARD_NODE_REGISTRY[node.type].labelKey)
}

function PortRow({
  edges,
  handle,
  node,
}: {
  edges: CanvasEdge[]
  handle: FlowHandleDefinition
  node: CanvasNode
}) {
  const { t } = useTranslation()
  const canvas = useFlowCanvas()
  const input = handle.direction === 'input'
  const connectedEdges = edges.filter(edge => input
    ? edge.target === node.id && edge.targetHandle === handle.id
    : edge.source === node.id && edge.sourceHandle === handle.id)
  const connectedNodes = connectedEdges.flatMap((edge) => {
    const connectedNode = canvas.getNode(input ? edge.source : edge.target)
    return connectedNode ? [connectedNode] : []
  })
  const inputState = input ? canvas.getInputState(node.id, handle.id) : null
  const model = getCanvasGenerationModel(node)
  const descriptionKey = model?.inputSlots.find(
    slot => slot.id === handle.id,
  )?.descriptionKey
  const label = handleLabel(handle, node, t, canvas)
  const Icon = input ? IconArrowDownToArc : IconArrowUpToArc

  return (
    <HoverCard>
      <HoverCardTrigger
        closeDelay={100}
        delay={150}
        render={(
          <Button
            aria-label={label}
            className="w-full justify-start gap-2 px-2 font-normal"
            size="sm"
            type="button"
            variant="ghost"
          />
        )}
      >
        <Icon aria-hidden data-icon="inline-start" />
        <span className="min-w-0 flex-1 truncate text-left">{label}</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {connectedEdges.length}
        </span>
      </HoverCardTrigger>
      <HoverCardContent align="start" side="left" sideOffset={12}>
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-medium">{label}</p>
              <p className="text-xs text-muted-foreground">
                {t('flows.inputStates.connections', {
                  count: connectedEdges.length,
                })}
              </p>
            </div>
            <Badge variant="secondary">
              {valueTypeLabel(handle.valueTypes[0], t)}
            </Badge>
          </div>
          {descriptionKey && (
            <p className="text-xs text-muted-foreground">
              {t(descriptionKey)}
            </p>
          )}
          {inputState && inputState.connectionCount > 0 && (
            <p className="text-xs text-muted-foreground">
              {t(inputState.mode === 'manual'
                ? 'flows.inputStates.customized'
                : 'flows.inputStates.automatic', {
                available: inputState.availableCount,
                count: inputState.selectedAvailableCount,
              })}
            </p>
          )}
          {connectedNodes.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {connectedNodes.map(connectedNode => (
                <div
                  className="
                    truncate rounded-md bg-muted/50 px-2 py-1.5 text-xs
                  "
                  key={connectedNode.id}
                  title={connectedNodeName(connectedNode, t, canvas)}
                >
                  {connectedNodeName(connectedNode, t, canvas)}
                </div>
              ))}
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}

export function FlowNodeConnectionsCard({
  edges,
  node,
}: {
  edges: CanvasEdge[]
  node: CanvasNode
}) {
  const { t } = useTranslation()
  const canvas = useFlowCanvas()
  const handles = getFlowNodeHandles(
    canvasNodeToGraphNode(node),
    canvas.referenceData,
  )
  const inputs = handles.filter(handle => handle.direction === 'input')
  const outputs = handles.filter(handle => handle.direction === 'output')

  if (inputs.length === 0 && outputs.length === 0)
    return null

  return (
    <aside
      aria-label={t('flows.connectionInspector.title')}
      className="nopan nowheel"
    >
      <Card className="w-80" size="sm">
        <CardHeader className="border-b">
          <CardTitle>{t('flows.connectionInspector.title')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {inputs.length > 0 && (
            <section className="flex flex-col gap-1">
              <h3 className="px-2 text-xs font-medium text-muted-foreground">
                {t('flows.connectionInspector.inputs')}
              </h3>
              {inputs.map(handle => (
                <PortRow edges={edges} handle={handle} key={handle.id} node={node} />
              ))}
            </section>
          )}
          {outputs.length > 0 && (
            <section className="flex flex-col gap-1">
              <h3 className="px-2 text-xs font-medium text-muted-foreground">
                {t('flows.connectionInspector.outputs')}
              </h3>
              {outputs.map(handle => (
                <PortRow edges={edges} handle={handle} key={handle.id} node={node} />
              ))}
            </section>
          )}
        </CardContent>
      </Card>
    </aside>
  )
}
