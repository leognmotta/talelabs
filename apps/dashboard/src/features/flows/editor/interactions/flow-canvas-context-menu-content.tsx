/** Context-menu presentation for pane, node, and multi-selection targets. */

import type { FlowNodeType } from '@talelabs/flows'
import type { CanvasContextTarget } from '../canvas-state/canvas-store'

import { ContextMenuContent } from '@talelabs/ui/components/context-menu'
import { memo } from 'react'
import { FlowCanvasNodeContextMenu } from './flow-canvas-node-context-menu'
import { FlowCanvasPaneContextMenu } from './flow-canvas-pane-context-menu'
import { FlowCanvasSelectionContextMenu } from './flow-canvas-selection-context-menu'

/** Renders the menu appropriate for the current scoped canvas target. */
export const FlowCanvasContextMenuContent = memo((input: {
  canAddNodeType: (nodeType: FlowNodeType) => boolean
  contextTarget: CanvasContextTarget
  getCanRunNode: (nodeId: string) => boolean
  shortcutLabels: Readonly<{ delete: string, duplicate: string }>
  onAddNode: (
    nodeType: FlowNodeType,
    position?: { x: number, y: number },
  ) => void
  onArrange: (nodeIds: string[]) => void
  onDeleteNodeIds: (nodeIds: string[]) => void
  onDeleteSelection: () => void
  onDuplicate: (nodeIds: string[]) => void
  onFitView: () => void
  onFocus: (nodeIds: string[], edgeIds: string[]) => void
  onRunFromHere: (nodeId: string, estimatedCredits?: number) => void
  onRunNode: (nodeId: string, estimatedCredits?: number) => void
  onRunSelection: (nodeIds: string[], estimatedCredits?: number) => void
  onRunTillHere: (nodeId: string, estimatedCredits?: number) => void
  onSelectAll: () => void
  onUploadAssets: (position: null | { x: number, y: number }) => void
}) => {
  const target = input.contextTarget
  return (
    <ContextMenuContent
      className={target.mode === 'pane' ? 'max-h-[70vh] w-64' : undefined}
      showOverflowAffordance={target.mode === 'pane'}
    >
      {target.mode === 'nodeActions' && target.nodeIds.length === 1
        ? (
            <FlowCanvasNodeContextMenu
              nodeId={target.nodeIds[0]!}
              shortcutLabels={input.shortcutLabels}
              onDeleteNodeIds={input.onDeleteNodeIds}
              onDuplicate={input.onDuplicate}
            />
          )
        : target.nodeIds.length > 0 || target.edgeIds.length > 0
          ? (
              <FlowCanvasSelectionContextMenu
                canArrange={target.nodeIds.length >= 2}
                canDuplicate={target.nodeIds.length > 0}
                canFocus={target.nodeIds.length > 0 || target.edgeIds.length > 0}
                canRun={target.nodeIds.some(input.getCanRunNode)}
                canRunNode={target.nodeIds.length === 1
                  ? input.getCanRunNode(target.nodeIds[0]!)
                  : false}
                deleteShortcut={input.shortcutLabels.delete}
                duplicateShortcut={input.shortcutLabels.duplicate}
                nodeIds={target.nodeIds}
                onArrange={() => input.onArrange(target.nodeIds)}
                onDelete={input.onDeleteSelection}
                onDuplicate={() => input.onDuplicate(target.nodeIds)}
                onFocus={() => input.onFocus(target.nodeIds, target.edgeIds)}
                onRun={estimatedCredits =>
                  input.onRunSelection(target.nodeIds, estimatedCredits)}
                onRunFromHere={target.nodeIds.length === 1
                  ? estimatedCredits => input.onRunFromHere(
                    target.nodeIds[0]!,
                    estimatedCredits,
                  )
                  : undefined}
                onRunNode={target.nodeIds.length === 1
                  ? estimatedCredits => input.onRunNode(
                    target.nodeIds[0]!,
                    estimatedCredits,
                  )
                  : undefined}
                onRunTillHere={target.nodeIds.length === 1
                  ? estimatedCredits => input.onRunTillHere(
                    target.nodeIds[0]!,
                    estimatedCredits,
                  )
                  : undefined}
              />
            )
          : (
              <FlowCanvasPaneContextMenu
                canAddNodeType={input.canAddNodeType}
                onAddNode={nodeType => input.onAddNode(
                  nodeType,
                  target.screenPosition ?? undefined,
                )}
                onFitView={input.onFitView}
                onSelectAll={input.onSelectAll}
                onUploadAssets={() => input.onUploadAssets(target.screenPosition)}
              />
            )}
    </ContextMenuContent>
  )
})
