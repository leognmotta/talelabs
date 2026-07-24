/** Canvas adapter for the shared saved-revision generation estimate query. */

import type { FlowRunPlanRequest } from '@talelabs/sdk'

import { isGenerationRunCostEstimateReady, useSavedGenerationRunCostEstimate } from '../../../generation/runs/use-saved-generation-run-cost-estimate'
import { useCanvasStore } from '../../editor/canvas-state/canvas-store-context'
import { useFlowCanvasRuntime } from '../../editor/flow-canvas-runtime-context'
import { useRunCostEstimateManifestFingerprint } from './flow-run-cost-estimate-provider'
import {
  createRunCostEstimateScopeFingerprint,
  normalizeRunCostEstimateCommand,
} from './run-cost-estimate-scope-fingerprint'

/** Shared saved-plan state retained as the canvas public type. */
export type { GenerationRunCostEstimateState as RunCostEstimateState } from '../../../generation/runs/use-saved-generation-run-cost-estimate'

/** Reports whether cost policy allows the related canvas run action. */
export const isRunCostEstimateReady = isGenerationRunCostEstimateReady

/** Run-plan command before the adapter supplies the saved Flow revision. */
export type RunCostEstimateCommand = FlowRunPlanRequest['command'] extends infer Command
  ? Command extends { expectedFlowRevision: number }
    ? Omit<Command, 'expectedFlowRevision'>
    : never
  : never

/** Adapts canvas state to the shared canonical saved-revision estimate query. */
export function useFlowRunCostEstimate(input: {
  /** Provider-neutral run command whose total should be displayed. */
  command: RunCostEstimateCommand
  /** Whether this control currently intends to expose its estimate. */
  enabled: boolean
}) {
  const runtime = useFlowCanvasRuntime()
  const normalizedCommand = normalizeRunCostEstimateCommand(input.command)
  const manifestFingerprint = useRunCostEstimateManifestFingerprint(
    normalizedCommand,
    input.enabled && runtime.fundingSource === 'credits',
  )
  const manifestScope = normalizedCommand.mode === 'all'
    || normalizedCommand.mode === 'node'
  const dirty = useCanvasStore(
    state => state.graphRevision !== state.savedRevision,
  )
  const serverRevision = useCanvasStore(state => state.serverRevision)
  const lazyScopeFingerprint = useCanvasStore(state => (
    input.enabled && !manifestScope
      ? createRunCostEstimateScopeFingerprint({
          command: normalizedCommand,
          edges: state.edges,
          nodes: state.nodes,
          referenceData: runtime.referenceData,
        })
      : ''
  ))
  return useSavedGenerationRunCostEstimate({
    command: normalizedCommand,
    costRequired: runtime.fundingSource === 'credits',
    dirty,
    enabled: input.enabled,
    executionMode: runtime.executionMode,
    executionRuntime: runtime.executionRuntime,
    flowId: runtime.flowId,
    organizationId: runtime.organizationId,
    requestDirectly: !manifestScope,
    savedRevision: serverRevision,
    scopeFingerprint: manifestFingerprint ?? lazyScopeFingerprint,
  })
}
