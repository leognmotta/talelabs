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
import { flowActiveRuns, flowRun, flowRuns } from './flow-query-key-runs'
import { flowList, flowLists, flowScope } from './flow-query-key-scope'

export const flowQueryKeys = {
  activeRuns: flowActiveRuns,
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
