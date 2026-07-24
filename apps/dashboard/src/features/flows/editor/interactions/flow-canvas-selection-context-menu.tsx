/** Context commands for the current node/edge selection snapshot. */

import {
  IconCopy,
  IconFocusCentered,
  IconHierarchy3,
  IconPlayerPlay,
  IconTrash,
} from '@tabler/icons-react'
import {
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from '@talelabs/ui/components/context-menu'
import { useTranslation } from 'react-i18next'
import { GenerationRunCostEstimate } from '../../../generation/runs/generation-run-cost-estimate'
import {
  isRunCostEstimateReady,
  useFlowRunCostEstimate,
} from '../../runs/cost-estimation/use-flow-run-cost-estimate'

/** Offers duplicate, lock, and delete commands for the current graph selection. */
export function FlowCanvasSelectionContextMenu({
  canArrange,
  canDuplicate,
  canFocus,
  canRun,
  canRunNode,
  deleteShortcut,
  duplicateShortcut,
  nodeIds,
  onArrange,
  onDelete,
  onDuplicate,
  onFocus,
  onRun,
  onRunFromHere,
  onRunNode,
  onRunTillHere,
}: {
  canArrange: boolean
  canDuplicate: boolean
  canFocus: boolean
  canRun: boolean
  canRunNode?: boolean
  deleteShortcut: string
  duplicateShortcut: string
  nodeIds: string[]
  onArrange: () => void
  onDelete: () => void
  onDuplicate: () => void
  onFocus: () => void
  onRun: () => void
  onRunFromHere?: () => void
  onRunNode?: () => void
  onRunTillHere?: () => void
}) {
  const { t } = useTranslation()
  const hasNodeRunActions = Boolean(onRunNode && onRunFromHere && onRunTillHere)
  const nodeId = nodeIds.length === 1 ? nodeIds[0] : undefined
  const nodeCost = useFlowRunCostEstimate({
    command: { mode: 'node', targetNodeId: nodeId ?? '' },
    enabled: Boolean(nodeId && canRunNode),
  })
  const fromHereCost = useFlowRunCostEstimate({
    command: { mode: 'downstream', targetNodeId: nodeId ?? '' },
    enabled: Boolean(nodeId && canRunNode),
  })
  const tillHereCost = useFlowRunCostEstimate({
    command: { mode: 'upstream', targetNodeId: nodeId ?? '' },
    enabled: Boolean(nodeId && canRunNode),
  })
  const selectionCost = useFlowRunCostEstimate({
    command: { mode: 'selection', selectedNodeIds: nodeIds },
    enabled: canRun && nodeIds.length > 0,
  })

  return (
    <>
      <ContextMenuGroup>
        {hasNodeRunActions
          ? (
              <>
                <ContextMenuItem
                  disabled={!canRunNode || !isRunCostEstimateReady(nodeCost)}
                  onClick={onRunNode}
                >
                  <IconPlayerPlay />
                  {t('flows.nodeToolbar.run')}
                  <ContextMenuShortcut>
                    <GenerationRunCostEstimate showTooltip={false} state={nodeCost} />
                  </ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem
                  disabled={!canRunNode || !isRunCostEstimateReady(fromHereCost)}
                  onClick={onRunFromHere}
                >
                  <IconPlayerPlay />
                  {t('flows.nodeToolbar.runFromHere')}
                  <ContextMenuShortcut>
                    <GenerationRunCostEstimate showTooltip={false} state={fromHereCost} />
                  </ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem
                  disabled={!canRunNode || !isRunCostEstimateReady(tillHereCost)}
                  onClick={onRunTillHere}
                >
                  <IconPlayerPlay />
                  {t('flows.nodeToolbar.runTillHere')}
                  <ContextMenuShortcut>
                    <GenerationRunCostEstimate showTooltip={false} state={tillHereCost} />
                  </ContextMenuShortcut>
                </ContextMenuItem>
              </>
            )
          : null}
        <ContextMenuItem
          disabled={!canRun || !isRunCostEstimateReady(selectionCost)}
          onClick={onRun}
        >
          <IconPlayerPlay />
          {t('flows.runSelection')}
          <ContextMenuShortcut>
            <GenerationRunCostEstimate showTooltip={false} state={selectionCost} />
          </ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuGroup>
      <ContextMenuSeparator />
      <ContextMenuGroup>
        <ContextMenuItem disabled={!canArrange} onClick={onArrange}>
          <IconHierarchy3 />
          {t('flows.autoFormat')}
        </ContextMenuItem>
        <ContextMenuItem disabled={!canDuplicate} onClick={onDuplicate}>
          <IconCopy />
          {t('flows.duplicateSelection')}
          <ContextMenuShortcut>{duplicateShortcut}</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem disabled={!canFocus} onClick={onFocus}>
          <IconFocusCentered />
          {t('flows.focusSelection')}
        </ContextMenuItem>
      </ContextMenuGroup>
      <ContextMenuSeparator />
      <ContextMenuGroup>
        <ContextMenuItem variant="destructive" onClick={onDelete}>
          <IconTrash />
          {t('flows.deleteSelection')}
          <ContextMenuShortcut>{deleteShortcut}</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuGroup>
    </>
  )
}
