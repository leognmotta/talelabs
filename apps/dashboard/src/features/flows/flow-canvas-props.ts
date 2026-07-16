import type {
  Flow,
  FlowGraphReferences,
  FlowGraphResponse,
  GenerationConfigResponse,
} from '@talelabs/sdk'

export interface FlowCanvasProps {
  flow: Flow
  generationConfig: GenerationConfigResponse
  graph: FlowGraphResponse
  organizationId: string
  references: FlowGraphReferences
}
