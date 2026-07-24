/**
 * Compatibility facade for HTTP route modules. Run-engine ownership lives in
 * `domain/runs`, where each lifecycle concern can evolve independently.
 */
export { admitFlowRun } from '../domain/runs/admission.service.js'
export { acknowledgeBrowserJobCancellation } from '../domain/runs/browser-runtime/browser-cancellation.service.js'
export { updateBrowserExecutorStatus } from '../domain/runs/browser-runtime/browser-executor-status.service.js'
export {
  beginBrowserJobSubmission,
  checkpointBrowserJob,
  completeBrowserJob,
  failBrowserJob,
} from '../domain/runs/browser-runtime/browser-job-transition.service.js'
export { claimBrowserRunJobs } from '../domain/runs/browser-runtime/browser-job.service.js'
export {
  acquireBrowserRunLease,
  releaseBrowserRunLease,
} from '../domain/runs/browser-runtime/browser-lease.service.js'
export { getBrowserRunManifest } from '../domain/runs/browser-runtime/browser-manifest.service.js'
export {
  createBrowserOutputGrant,
  finalizeBrowserMediaOutput,
  finalizeBrowserTextOutput,
} from '../domain/runs/browser-runtime/browser-output.service.js'
export { cancelRun } from '../domain/runs/cancellation.service.js'
export {
  admitDirectGeneration,
  estimateDirectGeneration,
} from '../domain/runs/direct-generation.service.js'
export { preflightFlowRun } from '../domain/runs/planning.service.js'
export { getFlowRunCostManifest } from '../domain/runs/provider-cost-manifest.service.js'
export {
  getRunDetail,
  listActiveRuns,
  listRunHistory,
} from '../domain/runs/read.service.js'
export { createRunRealtimeToken } from '../domain/runs/realtime.service.js'
export { reconcileRuns } from '../domain/runs/reconciliation.service.js'
export { retryRun } from '../domain/runs/retry.service.js'
