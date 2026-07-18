/**
 * Public durable run-engine tasks, policies, and narrow execution primitives.
 *
 * @packageDocumentation
 */

export { getGeneratedOutputStorageLocation } from './assets/outputs/generated-storage.js'
export {
  assertJobMatchesSnapshotExecutionContract,
  loadSnapshotExecutionContext,
} from './flow-runs/contracts/execution.js'
export { materializeJobInputs } from './flow-runs/execution/inputs/materialize.js'
export {
  completeGenerationJob,
  markJobFailed,
  persistProviderFacts,
} from './flow-runs/execution/job/state/index.js'
export { discardCanceledGenerationResult } from './flow-runs/execution/outputs/canceled-result.js'
export { finalizeGenerationOutputs } from './flow-runs/execution/outputs/finalizer.js'
export type {
  FinalizableGenerationJob,
  GenerationOutputCommitContext,
  GenerationOutputCommitGuard,
} from './flow-runs/execution/outputs/finalizer.js'
export { skipDescendants } from './flow-runs/orchestration/graph-failure.js'
export {
  claimFlowRunTriggerParent,
  claimUndispatchedFlowRuns,
} from './flow-runs/persistence/claims.js'
export {
  aggregateFlowRunState,
  aggregateGenerationJobState,
} from './flow-runs/persistence/state.js'
export { reconcileFlowRunStates } from './flow-runs/reconciliation/reconcile.js'
export {
  selectMockGenerationFixture,
} from './generation/adapters/mock/fixture-catalog.js'
export {
  createDeterministicMockTextOutput,
} from './generation/adapters/mock/text.js'
export { recordOpenRouterVideoCompletion } from './generation/adapters/openrouter/video/callback.js'
export { createGenerationAssetResolver } from './generation/inputs/asset-resolver.js'
export {
  batchTriggerTask,
  flowRunTaskOptions,
  triggerTask,
} from './platform/dispatch.js'
export type {
  TriggerBatchOptions,
  TriggerTaskOptions,
} from './platform/dispatch.js'
export {
  getTriggerEnvironment,
  getTriggerProjectRef,
  getTriggerSecretKey,
  TRIGGER_PROJECT_REF_ENV,
  TRIGGER_SECRET_KEY_ENV,
} from './platform/environment.js'
export type { TriggerEnv } from './platform/environment.js'
export * from './platform/sdk.js'
export { FLOW_RUN_EXECUTOR_CONTRACT_VERSION } from './platform/task-contracts.js'
export type {
  TriggerTaskId,
  TriggerTaskMap,
} from './platform/task-contracts.js'
export {
  safeRunFailureForResponse,
  toSafeRunFailure,
} from './shared/failures/run-failure.js'
export type {
  SafeRunFailure,
  SafeRunFailureBoundary,
  SafeRunFailureCode,
} from './shared/failures/run-failure.js'
