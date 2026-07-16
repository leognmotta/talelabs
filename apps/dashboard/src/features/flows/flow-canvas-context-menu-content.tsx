import type { FlowNodeType } from '@talelabs/flows'
import type { FlowCanvasContextTarget } from './use-flow-canvas-selection'

import { IconCopy, IconTrash } from '@tabler/icons-react'
import {
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from '@talelabs/ui/components/context-menu'
import { useTranslation } from 'react-i18next'
import { FlowCanvasPaneContextMenu } from './flow-canvas-pane-context-menu'
import { FlowCanvasSelectionContextMenu } from './flow-canvas-selection-context-menu'

export function FlowCanvasContextMenuContent(input: {
  canAddNodeType: (nodeType: FlowNodeType) => boolean
  contextTarget: FlowCanvasContextTarget
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
  onRunFromHere: (nodeId: string) => void
  onRunNode: (nodeId: string) => void
  onRunSelection: (nodeIds: string[]) => void
  onRunTillHere: (nodeId: string) => void
  onSelectAll: () => void
  onUploadAssets: (position: null | { x: number, y: number }) => void
}) {
  const { t } = useTranslation()
  const target = input.contextTarget
  return (
    <ContextMenuContent
      className={target.mode === 'pane' ? 'max-h-[70vh] w-64' : undefined}
      showOverflowAffordance={target.mode === 'pane'}
    >
      {target.mode === 'nodeActions' && target.nodeIds.length === 1
        ? (
            <>
              <ContextMenuGroup>
                <ContextMenuItem onClick={() => input.onDuplicate(target.nodeIds)}>
                  <IconCopy />
                  {t('flows.duplicateNode')}
                  <ContextMenuShortcut>
                    {input.shortcutLabels.duplicate}
                  </ContextMenuShortcut>
                </ContextMenuItem>
              </ContextMenuGroup>
              <ContextMenuSeparator />
              <ContextMenuGroup>
                <ContextMenuItem
                  variant="destructive"
                  onClick={() => input.onDeleteNodeIds(target.nodeIds)}
                >
                  <IconTrash />
                  {t('flows.deleteNode')}
                  <ContextMenuShortcut>
                    {input.shortcutLabels.delete}
                  </ContextMenuShortcut>
                </ContextMenuItem>
              </ContextMenuGroup>
            </>
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
                onArrange={() => input.onArrange(target.nodeIds)}
                onDelete={input.onDeleteSelection}
                onDuplicate={() => input.onDuplicate(target.nodeIds)}
                onFocus={() => input.onFocus(target.nodeIds, target.edgeIds)}
                onRun={() => input.onRunSelection(target.nodeIds)}
                onRunFromHere={target.nodeIds.length === 1
                  ? () => input.onRunFromHere(target.nodeIds[0]!)
                  : undefined}
                onRunNode={target.nodeIds.length === 1
                  ? () => input.onRunNode(target.nodeIds[0]!)
                  : undefined}
                onRunTillHere={target.nodeIds.length === 1
                  ? () => input.onRunTillHere(target.nodeIds[0]!)
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
}
