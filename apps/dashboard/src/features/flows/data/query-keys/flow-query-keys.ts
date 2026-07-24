/** Canonical Flow query-key API assembled from responsibility-specific builders. */

import {
  flowDetail,
  flowDetails,
  flowGraph,
} from './flow-query-key-details'
import { flowRunRealtimeToken } from './flow-query-key-realtime'
import {
  flowAllReferences,
  flowBrowserGenerationAvailability,
  flowGenerationConfig,
  flowReferences,
} from './flow-query-key-references'
import {
  createRunArchiveHistory,
  createRunCostEstimate,
  createRunHistories,
  createRunLiveHistories,
  createRunLiveHistory,
  flowActiveBrowserRuns,
  flowActiveRuns,
  flowRun,
  flowRunArchiveHistory,
  flowRunCostEstimate,
  flowRunHistories,
  flowRunHistory,
  flowRunLiveHistories,
  flowRunLiveHistory,
  flowRuns,
} from './flow-query-key-runs'
import { flowList, flowLists, flowScope } from './flow-query-key-scope'

/** Composed hierarchical query-key factory for Flow data and run observation. */
export const flowQueryKeys = {
  activeRuns: flowActiveRuns,
  activeBrowserRuns: flowActiveBrowserRuns,
  allReferences: flowAllReferences,
  browserGenerationAvailability: flowBrowserGenerationAvailability,
  createRunArchiveHistory,
  createRunCostEstimate,
  createRunHistories,
  createRunLiveHistories,
  createRunLiveHistory,
  detail: flowDetail,
  details: flowDetails,
  generationConfig: flowGenerationConfig,
  graph: flowGraph,
  list: flowList,
  lists: flowLists,
  references: flowReferences,
  run: flowRun,
  runArchiveHistory: flowRunArchiveHistory,
  runHistories: flowRunHistories,
  runHistory: flowRunHistory,
  runLiveHistories: flowRunLiveHistories,
  runLiveHistory: flowRunLiveHistory,
  runCostEstimate: flowRunCostEstimate,
  runRealtimeToken: flowRunRealtimeToken,
  runs: flowRuns,
  scope: flowScope,
}
