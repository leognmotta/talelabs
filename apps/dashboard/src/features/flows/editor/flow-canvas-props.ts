/** Shared server data required to initialize one Flow canvas. */

import type {
  Flow,
  FlowGraphReferences,
  FlowGraphResponse,
  GenerationConfigResponse,
} from '@talelabs/sdk'

/** Server-owned data and privileges required to initialize one Flow canvas. */
export interface FlowCanvasProps {
  canUseDebugMode: boolean
  flow: Flow
  generationConfig: GenerationConfigResponse
  graph: FlowGraphResponse
  organizationId: string
  references: FlowGraphReferences
}
