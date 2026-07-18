/** Canonical Flow query-key API assembled from responsibility-specific builders. */

import {
  flowDetail,
  flowDetails,
  flowGraph,
} from './flow-query-key-details'
import { flowRunRealtimeToken } from './flow-query-key-realtime'
import {
  flowAllReferences,
  flowGenerationConfig,
  flowReferences,
} from './flow-query-key-references'
import { flowActiveBrowserRuns, flowActiveRuns, flowRun, flowRuns } from './flow-query-key-runs'
import { flowList, flowLists, flowScope } from './flow-query-key-scope'

/** Composed hierarchical query-key factory for Flow data and run observation. */
export const flowQueryKeys = {
  activeRuns: flowActiveRuns,
  activeBrowserRuns: flowActiveBrowserRuns,
  allReferences: flowAllReferences,
  detail: flowDetail,
  details: flowDetails,
  generationConfig: flowGenerationConfig,
  graph: flowGraph,
  list: flowList,
  lists: flowLists,
  references: flowReferences,
  run: flowRun,
  runRealtimeToken: flowRunRealtimeToken,
  runs: flowRuns,
  scope: flowScope,
}
