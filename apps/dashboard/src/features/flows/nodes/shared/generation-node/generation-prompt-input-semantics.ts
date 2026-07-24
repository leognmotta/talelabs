/** Semantic equality guards for the shared generation prompt-input index. */

import type { PromptComposerInput } from '../../../../generation/prompt-composer/prompt-composer-types'
import type {
  CanvasEdge,
  CanvasNode,
  FlowGenerationPreview,
} from '../../../editor/flow-canvas-types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function scalarRecordEqual(left: unknown, right: unknown): boolean {
  if (left === right)
    return true
  if (!isRecord(left) || !isRecord(right))
    return false
  const leftEntries = Object.entries(left)
  if (leftEntries.length !== Object.keys(right).length)
    return false
  return leftEntries.every(([key, value]) => right[key] === value)
}

function stringArrayEqual(left: unknown, right: unknown): boolean {
  if (left === right)
    return true
  if (!Array.isArray(left) || !Array.isArray(right))
    return false
  return left.length === right.length
    && left.every((value, index) => value === right[index])
}

function inputSelectionsEqual(left: unknown, right: unknown): boolean {
  if (left === right)
    return true
  if (!isRecord(left) || !isRecord(right))
    return false
  const leftEntries = Object.entries(left)
  if (leftEntries.length !== Object.keys(right).length)
    return false
  return leftEntries.every(([slotId, leftSelection]) => {
    const rightSelection = right[slotId]
    if (!isRecord(leftSelection) || !isRecord(rightSelection))
      return leftSelection === rightSelection
    return leftSelection.mode === rightSelection.mode
      && stringArrayEqual(leftSelection.assetIds, rightSelection.assetIds)
  })
}

/** Whether two canvas nodes can produce the same prompt-input projection. */
export function haveSamePromptInputNodeSemantics(
  left: CanvasNode,
  right: CanvasNode,
): boolean {
  if (left === right)
    return true
  return left.id === right.id
    && left.type === right.type
    && left.assetId === right.assetId
    && left.schemaVersion === right.schemaVersion
    && left.data.elementId === right.data.elementId
    && left.data.modelContractVersion === right.data.modelContractVersion
    && left.data.modelId === right.data.modelId
    && left.data.operationId === right.data.operationId
    && stringArrayEqual(
      left.data.selectedAssetIds,
      right.data.selectedAssetIds,
    )
    && scalarRecordEqual(left.data.settings, right.data.settings)
    && inputSelectionsEqual(
      left.data.inputSelections,
      right.data.inputSelections,
    )
}

/** Whether two edges preserve the same ordered prompt-input dependency. */
export function haveSamePromptInputEdgeSemantics(
  left: CanvasEdge,
  right: CanvasEdge,
): boolean {
  return left === right || (
    left.id === right.id
    && left.source === right.source
    && left.sourceHandle === right.sourceHandle
    && left.target === right.target
    && left.targetHandle === right.targetHandle
    && left.data?.createdAt === right.data?.createdAt
  )
}

/** Whether a preview update can change addressable prompt media. */
export function haveSamePromptInputPreviewSemantics(
  left: FlowGenerationPreview | undefined,
  right: FlowGenerationPreview | undefined,
): boolean {
  return left === right || (
    left?.output === right?.output
    && left?.resultSets === right?.resultSets
  )
}

/** Whether a rebuilt prompt-input slice is presentation-equivalent. */
export function haveSamePromptInputs(
  left: readonly PromptComposerInput[],
  right: readonly PromptComposerInput[],
): boolean {
  return left === right || (
    left.length === right.length
    && left.every((item, index) => {
      const candidate = right[index]
      if (!candidate)
        return false
      return item.index === candidate.index
        && item.mediaType === candidate.mediaType
        && item.name === candidate.name
        && item.previewUrl === candidate.previewUrl
        && item.slotId === candidate.slotId
    })
  )
}
