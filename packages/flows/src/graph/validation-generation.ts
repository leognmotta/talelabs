/** Generation input selection and capability constraint validation. */

import type {
  FlowGraphEdge,
  FlowGraphIssue,
  FlowGraphNode,
  FlowGraphValidationContext,
  FlowInputSelection,
} from './types.js'
import {
  getActiveGenerationInputSlots,
  getGenerationModel,
  isAdaptiveGenerationNodeType,
  isGenerationNodeType,
} from '../generation/registry/index.js'
import {
  getAdaptiveGenerationInlineValues,
  resolveAdaptiveGenerationState,
} from '../generation/resolution/adaptive.js'
import { evaluateGenerationContract } from '../generation/resolution/evaluator.js'
import { compareFlowEdgesByPriority } from './ordering/edges.js'
import { addFlowGraphIssue } from './validation-issues.js'
import {
  sourceCandidateAssetIds,
  sourceRuntimeItemCount,
} from './validation-nodes.js'

/** Validates manual media selection identity, availability, and slot limits. */
export function validateGenerationSelections(
  nodesById: Map<string, FlowGraphNode>,
  edges: readonly FlowGraphEdge[],
  context: FlowGraphValidationContext,
  issues: FlowGraphIssue[],
  requiredNodeIds: ReadonlySet<string> | null,
) {
  for (const node of nodesById.values()) {
    if (!isGenerationNodeType(node.type))
      continue
    if (requiredNodeIds && !requiredNodeIds.has(node.id))
      continue

    const modelId
      = typeof node.data.modelId === 'string' ? node.data.modelId : ''
    const model = getGenerationModel(modelId, node.data.modelContractVersion)
    if (!model)
      continue

    const selections = node.data.inputSelections as Record<
      string,
      FlowInputSelection
    >
    const slotsById = new Map(model.inputSlots.map(slot => [slot.id, slot]))
    for (const slotId of Object.keys(selections)) {
      if (!slotsById.has(slotId)) {
        addFlowGraphIssue(
          issues,
          'unknown_input_selection',
          `nodes.${node.id}.data.inputSelections.${slotId}`,
        )
      }
    }

    const selectionSlots = isAdaptiveGenerationNodeType(node.type)
      ? model.inputSlots
      : getActiveGenerationInputSlots(model, node.data.operationId)
    for (const slot of selectionSlots) {
      const selection = selections[slot.id]
      if (!selection || selection.mode === 'auto')
        continue

      const uniqueAssetIds = new Set(selection.assetIds)
      if (uniqueAssetIds.size !== selection.assetIds.length) {
        addFlowGraphIssue(
          issues,
          'duplicate_selected_asset',
          `nodes.${node.id}.data.inputSelections.${slot.id}.assetIds`,
        )
      }
      const candidateOccurrences = new Map<string, number>()
      for (const edge of edges) {
        if (edge.targetNodeId !== node.id || edge.targetHandle !== slot.id)
          continue
        const sourceNode = nodesById.get(edge.sourceNodeId)
        if (!sourceNode)
          continue
        for (const assetId of sourceCandidateAssetIds(
          sourceNode,
          context,
          slot.accepts,
        )) {
          candidateOccurrences.set(
            assetId,
            (candidateOccurrences.get(assetId) ?? 0) + 1,
          )
        }
      }

      if (!requiredNodeIds?.has(node.id))
        continue

      const validSelectedCount = selection.assetIds.reduce(
        (count, assetId) => count + (candidateOccurrences.get(assetId) ?? 0),
        0,
      )
      if (validSelectedCount > slot.maxItems) {
        addFlowGraphIssue(
          issues,
          'input_selection_overflow',
          `nodes.${node.id}.data.inputSelections.${slot.id}.assetIds`,
          { maximum: slot.maxItems },
        )
      }

      for (const [assetIndex, assetId] of selection.assetIds.entries()) {
        if (!candidateOccurrences.has(assetId)) {
          addFlowGraphIssue(
            issues,
            'selected_asset_not_candidate',
            `nodes.${node.id}.data.inputSelections.${slot.id}.assetIds.${assetIndex}`,
          )
        }
      }
    }
  }
}

/** Evaluates generation input counts and model cross-field constraints. */
export function validateGenerationConstraints(
  nodesById: Map<string, FlowGraphNode>,
  edges: readonly FlowGraphEdge[],
  context: FlowGraphValidationContext,
  issues: FlowGraphIssue[],
  requiredNodeIds: ReadonlySet<string> | null,
) {
  for (const node of nodesById.values()) {
    if (!isGenerationNodeType(node.type))
      continue
    if (requiredNodeIds && !requiredNodeIds.has(node.id))
      continue
    const model = getGenerationModel(
      String(node.data.modelId ?? ''),
      node.data.modelContractVersion,
    )
    if (!model)
      continue
    const requireComplete = requiredNodeIds?.has(node.id) ?? false

    const connectionCounts: Record<string, number> = {}
    for (const edge of edges) {
      if (edge.targetNodeId !== node.id || !edge.targetHandle)
        continue
      connectionCounts[edge.targetHandle]
        = (connectionCounts[edge.targetHandle] ?? 0) + 1
    }
    const settings = node.data.settings as Record<
      string,
      boolean | number | string
    >
    const itemCounts: Record<string, number> = {}
    const selections = node.data.inputSelections as Record<
      string,
      FlowInputSelection
    >
    for (const slot of model.inputSlots) {
      const candidateOccurrences = new Map<string, number>()
      let opaqueRuntimeItems = 0
      for (const edge of edges.toSorted(compareFlowEdgesByPriority)) {
        if (edge.targetNodeId !== node.id || edge.targetHandle !== slot.id)
          continue
        const sourceNode = nodesById.get(edge.sourceNodeId)
        if (!sourceNode)
          continue
        const assetIds = sourceCandidateAssetIds(
          sourceNode,
          context,
          slot.accepts,
        )
        for (const assetId of assetIds) {
          candidateOccurrences.set(
            assetId,
            (candidateOccurrences.get(assetId) ?? 0) + 1,
          )
        }
        if (!assetIds.length)
          opaqueRuntimeItems += sourceRuntimeItemCount(sourceNode)
      }
      const selection = selections[slot.id]
      const selectedCandidateCount
        = selection?.mode === 'manual'
          ? selection.assetIds.reduce(
              (count, assetId) => (
                count + (candidateOccurrences.get(assetId) ?? 0)
              ),
              0,
            )
          : Math.min(
              [...candidateOccurrences.values()].reduce(
                (count, occurrences) => count + occurrences,
                0,
              ),
              slot.maxItems,
            )
      itemCounts[slot.id] = selectedCandidateCount + opaqueRuntimeItems
    }
    const adaptiveEvaluation = isAdaptiveGenerationNodeType(node.type)
      ? resolveAdaptiveGenerationState({
          connectionCounts,
          ...getAdaptiveGenerationInlineValues(node.data),
          itemCounts,
          model,
          nodeType: node.type,
          settings,
        })
      : null
    const evaluation
      = adaptiveEvaluation
        ?? evaluateGenerationContract({
          connectionCounts,
          itemCounts,
          model,
          operationId: String(node.data.operationId ?? ''),
          requireComplete,
          settings,
        })
    if (
      adaptiveEvaluation
      && adaptiveEvaluation.resolvedOperationId
      !== String(node.data.operationId ?? '')
    ) {
      addFlowGraphIssue(
        issues,
        'derived_operation_mismatch',
        `nodes.${node.id}.data.operationId`,
        { resolvedOperationId: adaptiveEvaluation.resolvedOperationId ?? '' },
      )
    }
    const incompleteCodes = new Set([
      'generation_input_at_least_one',
      'generation_input_required',
      'generation_setting_required',
    ])
    for (const contractIssue of evaluation.issues) {
      if (!requireComplete && incompleteCodes.has(contractIssue.code))
        continue
      addFlowGraphIssue(
        issues,
        contractIssue.code,
        contractIssue.inputId
          ? `nodes.${node.id}.handles.${contractIssue.inputId}`
          : contractIssue.settingId
            ? `nodes.${node.id}.data.settings.${contractIssue.settingId}`
            : `nodes.${node.id}.data`,
        {
          ...(contractIssue.constraintId
            ? { constraint: contractIssue.constraintId }
            : {}),
          ...(contractIssue.messageKey
            ? { messageKey: contractIssue.messageKey }
            : {}),
        },
      )
    }
  }
}
