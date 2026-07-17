/** Selected-node input and output connection preview inspector. */

import type { FlowHandleDefinition } from '@talelabs/flows'
import type { CanvasEdge, CanvasNode } from './flow-canvas-types'
import type { PortPreviewItem } from './flow-node-port-preview'
/* eslint-disable better-tailwindcss/no-unknown-classes -- React Flow uses these interaction classes as behavior hooks. */

import { IconLogin2, IconLogout2 } from '@tabler/icons-react'
import { getFlowNodeHandles } from '@talelabs/flows'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@talelabs/ui/components/card'
import { useMemo, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { useCanvasStoreApi } from './canvas-state/canvas-store-context'
import { useFlowCanvasRuntime } from './flow-canvas-runtime-context'
import { canvasNodeToGraphNode } from './flow-canvas-serialization'
import { createFlowGenerationCanvasBridge } from './flow-generation-canvas-bridge'
import { inputPortPreviewItems } from './flow-node-port-input-items'
import { FlowNodePortItemRow } from './flow-node-port-item-row'
import { outputPortPreviewItems } from './flow-node-port-output-items'
import { flowNodeHandleLabel } from './flow-node-port-preview'

interface PortPreviewGroup {
  handle: FlowHandleDefinition
  items: PortPreviewItem[]
  label: string
}

/** Renders available input and output values for the selected node. */
export function FlowNodeConnectionsCard({
  edges,
  node,
}: {
  edges: CanvasEdge[]
  node: CanvasNode
}) {
  const { t } = useTranslation()
  const store = useCanvasStoreApi()
  const runtime = useFlowCanvasRuntime()
  useSyncExternalStore(
    runtime.subscribeGenerationPreviews,
    () => edges.map(edge => JSON.stringify(
      runtime.getGenerationPreview(edge.source) ?? null,
    )).join(':'),
    () => '',
  )
  const generationCanvas = useMemo(() => createFlowGenerationCanvasBridge({
    referenceData: runtime.referenceData,
    store,
  }), [runtime.referenceData, store])
  const canvas = useMemo(() => ({
    ...generationCanvas,
    getGenerationPreview: runtime.getGenerationPreview,
  }), [generationCanvas, runtime.getGenerationPreview])
  const handles = getFlowNodeHandles(
    canvasNodeToGraphNode(node),
    canvas.referenceData,
  )
  const inputGroups: PortPreviewGroup[] = handles
    .filter(handle => handle.direction === 'input')
    .map((handle) => {
      const label = flowNodeHandleLabel(handle, node, t)
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
      const label = flowNodeHandleLabel(handle, node, t)
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
                <IconLogout2 aria-hidden className="size-4 text-success" />
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
