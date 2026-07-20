/** Context-menu commands for one right-clicked canvas node. */

import type { FlowNodeType } from '@talelabs/flows'

import {
  IconClipboardCopy,
  IconCopy,
  IconDownload,
  IconLock,
  IconLockOpen,
  IconSwitchHorizontal,
  IconTrash,
} from '@tabler/icons-react'
import {
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from '@talelabs/ui/components/context-menu'
import { useTranslation } from 'react-i18next'
import { useAssetDownload } from '../../../assets/viewer/use-asset-download'
import { downloadFile } from '../../nodes/shared/toolbars/download-file'
import { useCopyOutputText } from '../../nodes/shared/toolbars/use-copy-output-text'
import { updateCanvasNodeData } from '../canvas-state/canvas-node-actions'
import { useCanvasStore, useCanvasStoreApi } from '../canvas-state/canvas-store-context'
import { useFlowCanvasRuntime, useFlowGenerationPreview } from '../flow-canvas-runtime-context'

/**
 * Renders the single-node context-menu items. Owns node-scoped commands that
 * left the retired node toolbar (2026-07-19 placement decision): switch
 * element, output download/copy, lock, and delete; duplicate/delete execution
 * stays with the canvas command layer via the injected handlers.
 */
export function FlowCanvasNodeContextMenu({
  nodeId,
  shortcutLabels,
  onDeleteNodeIds,
  onDuplicate,
}: {
  nodeId: string
  shortcutLabels: Readonly<{ delete: string, duplicate: string }>
  onDeleteNodeIds: (nodeIds: string[]) => void
  onDuplicate: (nodeIds: string[]) => void
}) {
  const { t } = useTranslation()
  const store = useCanvasStoreApi()
  const runtime = useFlowCanvasRuntime()
  const downloadAsset = useAssetDownload()
  const node = useCanvasStore(
    state => state.nodes.find(candidate => candidate.id === nodeId),
  )
  const preview = useFlowGenerationPreview(nodeId)
  const output = preview && 'output' in preview ? preview.output ?? null : null
  const outputText = output?.kind === 'text' ? output.text : null
  const copyOutputText = useCopyOutputText(outputText)

  if (!node)
    return null

  const nodeType: FlowNodeType = node.type
  const locked = node.data.locked === true
  const assetId = nodeType === 'asset' ? node.assetId : undefined
  const outputAssetId = output?.kind === 'media' ? output.assetId : undefined
  const downloadGenerationOutput = output?.kind === 'media'
    ? outputAssetId
      ? () => void downloadAsset(outputAssetId)
      : undefined
    : output
      ? () => downloadFile(output.download)
      : undefined
  const downloadOutput = downloadGenerationOutput
    ?? (assetId ? () => void downloadAsset(assetId) : undefined)

  return (
    <>
      <ContextMenuGroup>
        {nodeType === 'element' && (
          <ContextMenuItem
            onClick={() => store.setState({ elementPickerNodeId: nodeId })}
          >
            <IconSwitchHorizontal />
            {t('elements.switchElement')}
          </ContextMenuItem>
        )}
        {downloadOutput && (
          <ContextMenuItem onClick={downloadOutput}>
            <IconDownload />
            {t('assets.download')}
          </ContextMenuItem>
        )}
        {outputText !== null && (
          <ContextMenuItem onClick={() => void copyOutputText()}>
            <IconClipboardCopy />
            {t('flows.llm.preview.copy')}
          </ContextMenuItem>
        )}
        <ContextMenuItem onClick={() => onDuplicate([nodeId])}>
          <IconCopy />
          {t('flows.duplicateNode')}
          <ContextMenuShortcut>
            {shortcutLabels.duplicate}
          </ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => updateCanvasNodeData({
            referenceData: runtime.referenceData,
            store,
          }, nodeId, current => ({ ...current, locked: !locked }))}
        >
          {locked ? <IconLockOpen /> : <IconLock />}
          {t(locked ? 'flows.nodeToolbar.unlock' : 'flows.nodeToolbar.lock')}
        </ContextMenuItem>
      </ContextMenuGroup>
      <ContextMenuSeparator />
      <ContextMenuGroup>
        <ContextMenuItem
          variant="destructive"
          onClick={() => onDeleteNodeIds([nodeId])}
        >
          <IconTrash />
          {t('flows.deleteNode')}
          <ContextMenuShortcut>
            {shortcutLabels.delete}
          </ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuGroup>
    </>
  )
}
