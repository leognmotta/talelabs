/**
 * Deterministic runtime-coordinate and generation-job expansion.
 *
 * This stage resolves deferred same-run outputs in topological order, expands
 * runtime multiplicity, and hashes immutable provider-neutral request shards.
 */

import type { FlowItem, FlowRuntimeValue } from '../values/runtime-values.js'
import type { FlowRunExecutionMaterialization } from './execution-materialization.js'
import type { RuntimeInputBinding } from './input-coordinates.js'
import type { FlowRunLimits } from './limits.js'
import type {
  FlowRunPlanningStageResult,
  PlannedExecutionNode,
  PlannedNodeWorkItem,
} from './planner-contracts.js'
import type { FlowRunPlanningIssue } from './run-command.js'

import {
  GENERATION_CATALOG_REVISION,
  GENERATION_CATALOG_VERSION,
} from '../../generation/registry/index.js'
import { resolvePromptTemplate } from '../../prompts/resolve.js'
import { hashFlowRunJob } from '../serialization/execution-hashes.js'
import { promptTemplateInputsFromRequest } from '../values/provider-input-selections.js'
import {
  createRuntimeItem,
  deriveRuntimeItemKey,
} from '../values/runtime-items.js'
import { expandRuntimeInputCoordinates } from './input-coordinates.js'
import { createPlannedJobRequestPayload } from './planner-node-inputs.js'
import { plannedRuntimeOutputValue } from './planner-outputs.js'
import { RuntimeCoordinateLimitError } from './runtime-coordinate-limit-error.js'

/** Expanded execution nodes and bounded summary counts for final assembly. */
export interface ExpandedFlowRunJobs {
  executionNodes: readonly PlannedExecutionNode[]
  expectedOutputCount: number
  plannedItemCount: number
  plannedJobCount: number
}

/** Expands materialized execution inputs into immutable work items and jobs. */
export function expandFlowRunJobs(input: {
  limits: FlowRunLimits
  materialization: FlowRunExecutionMaterialization
}): FlowRunPlanningStageResult<ExpandedFlowRunJobs> {
  const issues: FlowRunPlanningIssue[] = [...input.materialization.issues]
  const outputsByNodeId = new Map<string, readonly FlowItem<FlowRuntimeValue>[]>()
  const executionNodes: PlannedExecutionNode[] = []

  for (const materialized of input.materialization.nodes) {
    const bindings: RuntimeInputBinding[] = materialized.inputs.map(binding => ({
      edgeId: binding.edgeId,
      items: binding.source === 'captured'
        ? binding.items
        : outputsByNodeId.get(binding.sourceNodeId) ?? [],
      sourceHandleId: binding.sourceHandleId,
      sourceNodeId: binding.sourceNodeId,
      targetHandleId: binding.targetHandleId,
    }))

    let coordinates
    try {
      coordinates = expandRuntimeInputCoordinates(
        bindings,
        input.limits.itemsPerNode,
      )
    }
    catch (error) {
      if (!(error instanceof RuntimeCoordinateLimitError))
        throw error
      return {
        issues: [...issues, {
          code: 'run_items_per_node_limit',
          field: `nodes.${materialized.node.id}.items`,
          nodeId: materialized.node.id,
          params: { maximum: input.limits.itemsPerNode },
        }],
        ok: false,
      }
    }

    const workItems: PlannedNodeWorkItem[] = []
    for (const [sortOrder, coordinate] of coordinates.entries()) {
      for (const inputBinding of coordinate.inputs) {
        if (
          inputBinding.binding.items.length > 0
          && inputBinding.items.length === 0
        ) {
          issues.push({
            code: 'runtime_dimension_coordinate_missing',
            field: `nodes.${materialized.node.id}.handles.${inputBinding.binding.targetHandleId}`,
            nodeId: materialized.node.id,
            slotId: inputBinding.binding.targetHandleId,
          })
        }
      }
      if (Object.keys(coordinate.dimensions).length > input.limits.dimensionsPerItem) {
        issues.push({
          code: 'run_item_dimension_limit',
          field: `nodes.${materialized.node.id}.items.${sortOrder}.dimensions`,
          nodeId: materialized.node.id,
          params: { maximum: input.limits.dimensionsPerItem },
        })
      }
      const itemKey = deriveRuntimeItemKey({
        dimensions: coordinate.dimensions,
        lineage: coordinate.lineage,
        nodeId: materialized.node.id,
      })
      const plannedInputs = coordinate.inputs.map(({ binding, items }) => ({
        edgeId: binding.edgeId,
        items,
        sourceHandleId: binding.sourceHandleId,
        sourceNodeId: binding.sourceNodeId,
        targetHandleId: binding.targetHandleId,
      }))
      const requestIndex = 0
      const requestPayload = createPlannedJobRequestPayload({
        catalogRevision: GENERATION_CATALOG_REVISION,
        catalogVersion: GENERATION_CATALOG_VERSION,
        inputLimits: Object.fromEntries(
          materialized.model.inputSlots.map(slot => [slot.id, slot.maxItems]),
        ),
        inputs: plannedInputs,
        itemKey,
        modelContractVersion: String(materialized.node.data.modelContractVersion),
        modelId: materialized.model.id,
        modelRevision: materialized.model.revision!,
        node: materialized.node,
        operationId: materialized.operationId,
        outputCount: materialized.outputCount,
        requestIndex,
        settings: materialized.settings,
      })
      let promptReferencesValid = true
      for (const [slotId, template] of Object.entries(
        requestPayload.promptTemplates ?? {},
      )) {
        const connectedText = requestPayload.inputs.some(inputBinding => (
          inputBinding.targetHandleId === slotId
          && inputBinding.items.some(item => item.value.kind === 'text')
        ))
        if (connectedText)
          continue
        const resolution = resolvePromptTemplate({
          inputs: promptTemplateInputsFromRequest(requestPayload),
          template,
        })
        for (const issue of resolution.issues) {
          promptReferencesValid = false
          issues.push({
            code: issue.code,
            field: `nodes.${materialized.node.id}.data.${slotId}.parts.${issue.partIndex}`,
            nodeId: materialized.node.id,
            params: {
              index: issue.index,
              mediaType: issue.mediaType,
              slotId: issue.slotId,
            },
            slotId: issue.slotId,
          })
        }
      }
      if (!promptReferencesValid)
        continue
      workItems.push(Object.freeze({
        dimensions: coordinate.dimensions,
        expectedOutputCount: materialized.outputCount,
        inputs: Object.freeze(plannedInputs),
        itemKey,
        lineage: coordinate.lineage,
        requestShards: Object.freeze([{
          jobHash: hashFlowRunJob(requestPayload),
          requestPayload,
          requestIndex,
        }]),
        sortOrder,
      }))
    }

    if (workItems.length > input.limits.itemsPerNode) {
      issues.push({
        code: 'run_items_per_node_limit',
        field: `nodes.${materialized.node.id}.items`,
        nodeId: materialized.node.id,
        params: { maximum: input.limits.itemsPerNode },
      })
    }

    outputsByNodeId.set(materialized.node.id, workItems.map(workItem =>
      createRuntimeItem({
        dimensions: workItem.dimensions,
        key: workItem.itemKey,
        lineage: workItem.lineage,
        nodeId: materialized.node.id,
        value: plannedRuntimeOutputValue({
          itemKey: workItem.itemKey,
          mediaType: materialized.model.mediaType,
          nodeId: materialized.node.id,
          outputCount: materialized.outputCount,
        }),
      })))
    executionNodes.push(Object.freeze({
      catalogRevision: GENERATION_CATALOG_REVISION,
      catalogVersion: GENERATION_CATALOG_VERSION,
      inclusionReason: materialized.inclusionReason,
      level: materialized.level,
      modelContractVersion: String(materialized.node.data.modelContractVersion),
      modelId: materialized.model.id,
      modelRevision: materialized.model.revision!,
      nodeId: materialized.node.id,
      nodeType: materialized.nodeType,
      operationId: materialized.operationId,
      outputHandleId: materialized.outputHandleId,
      outputValueType: materialized.outputValueType,
      settings: materialized.settings,
      workItems: Object.freeze(workItems),
    }))
  }

  const plannedItemCount = executionNodes
    .reduce((count, node) => count + node.workItems.length, 0)
  const plannedJobCount = executionNodes.reduce(
    (count, node) => count + node.workItems.reduce(
      (nodeCount, item) => nodeCount + item.requestShards.length,
      0,
    ),
    0,
  )
  const expectedOutputCount = executionNodes.reduce(
    (count, node) => count + node.workItems.reduce(
      (nodeCount, item) => nodeCount + item.expectedOutputCount,
      0,
    ),
    0,
  )
  if (plannedJobCount > input.limits.jobsPerRun) {
    issues.push({
      code: 'run_job_limit',
      field: 'plan.jobs',
      params: { maximum: input.limits.jobsPerRun },
    })
  }
  if (expectedOutputCount > input.limits.outputsPerRun) {
    issues.push({
      code: 'run_output_limit',
      field: 'plan.outputs',
      params: { maximum: input.limits.outputsPerRun },
    })
  }
  if (issues.length > 0)
    return { issues, ok: false }

  return {
    ok: true,
    value: Object.freeze({
      executionNodes: Object.freeze(executionNodes),
      expectedOutputCount,
      plannedItemCount,
      plannedJobCount,
    }),
  }
}
