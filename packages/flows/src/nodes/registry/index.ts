/** Public node-registry schemas, migrations, handles, and validation exports. */

export { getDefaultNodeData } from '../data/defaults.js'
export { parseAndUpcastFlowNodeData } from '../data/reader.js'
export {
  FLOW_NODE_TYPE_REGISTRY,
  FLOW_NODE_TYPES,
  GENERATION_OUTPUT_HANDLE_IDS,
  getFlowNodeTypeDefinition,
  getGenerationOutputHandleId,
  isFlowNodeType,
  SELECTABLE_FLOW_NODE_TYPES,
} from './types.js'
export {
  validateFlowNodeRegistry,
  validateNodeReferences,
} from './validation.js'
