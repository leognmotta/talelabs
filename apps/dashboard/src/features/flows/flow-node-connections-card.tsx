import type { FlowHandleDefinition } from '@talelabs/flows'
import type { CanvasEdge, CanvasNode } from './flow-canvas-types'
import type { PortPreviewItem } from './flow-node-port-preview'
/* eslint-disable better-tailwindcss/no-unknown-classes -- React Flow uses these interaction classes as behavior hooks. */

import { IconLogin2, IconLogout2 } from '@tabler/icons-react'
import {
  getFlowNodeHandles,
  getGenerationMediaTypeForNode,
  isGenerationNodeType,
} from '@talelabs/flows'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@talelabs/ui/components/card'
import { useTranslation } from 'react-i18next'
import { useFlowCanvas } from './flow-canvas-context'
import { canvasNodeToGraphNode } from './flow-canvas-serialization'
import { FlowNodePortItemRow } from './flow-node-port-item-row'
import {
  flowNodeHandleLabel,
  inputPortPreviewItems,
  outputPortPreviewItems,
} from './flow-node-port-preview'

interface PortPreviewGroup {
  handle: FlowHandleDefinition
  items: PortPreviewItem[]
  label: string
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
  const opensInputSelectionSheet = !isGenerationNodeType(node.type)
    || getGenerationMediaTypeForNode(node.type) !== 'audio'
  const inputGroups: PortPreviewGroup[] = handles
    .filter(handle => handle.direction === 'input')
    .map((handle) => {
      const label = flowNodeHandleLabel(handle, node, t, canvas)
      return {
        handle,
        items: inputPortPreviewItems(edges, handle, node, canvas, t),
        label,
      }
    })
    .filter(group => group.items.length > 0)
  const outputGroups: PortPreviewGroup[] = handles
    .filter(handle => handle.direction === 'output')
    .map((handle) => {
      const label = flowNodeHandleLabel(handle, node, t, canvas)
      return {
        handle,
        items: outputPortPreviewItems(handle, node, canvas, t),
        label,
      }
    })
    .filter(group => group.items.length > 0)

  if (inputGroups.length === 0 && outputGroups.length === 0)
    return null

  return (
    <aside
      aria-label={t('flows.connectionInspector.title')}
      className="nopan nowheel"
      id={`flow-node-connections-${node.id}`}
      tabIndex={-1}
    >
      <Card className="w-80" size="sm">
        <CardHeader className="border-b">
          <CardTitle>{t('flows.connectionInspector.title')}</CardTitle>
        </CardHeader>
        <CardContent className="
          flex max-h-[min(32rem,70vh)] flex-col gap-4 overflow-y-auto
        "
        >
          {inputGroups.length > 0 && (
            <section className="flex flex-col gap-1">
              <h3 className="
                flex items-center gap-1.5 px-2 text-xs font-medium
                text-muted-foreground
              "
              >
                <IconLogin2 aria-hidden className="size-4 text-violet-400" />
                <span>{t('flows.connectionInspector.inputs')}</span>
              </h3>
              {inputGroups.flatMap(group => group.items.map(item => (
                <FlowNodePortItemRow
                  item={item}
                  key={`${group.handle.id}:${item.id}`}
                  label={group.label}
                  onActivate={opensInputSelectionSheet
                    && canvas.getInputState(node.id, group.handle.id)
                    ? () => canvas.openInputInspector(node.id, group.handle.id)
                    : undefined}
                />
              )))}
            </section>
          )}
          {outputGroups.length > 0 && (
            <section className="flex flex-col gap-1">
              <h3 className="
                flex items-center gap-1.5 px-2 text-xs font-medium
                text-muted-foreground
              "
              >
                <IconLogout2 aria-hidden className="size-4 text-emerald-400" />
                <span>{t('flows.connectionInspector.outputs')}</span>
              </h3>
              {outputGroups.flatMap(group => group.items.map(item => (
                <FlowNodePortItemRow
                  item={item}
                  key={`${group.handle.id}:${item.id}`}
                  label={group.label}
                />
              )))}
            </section>
          )}
        </CardContent>
      </Card>
    </aside>
  )
}
