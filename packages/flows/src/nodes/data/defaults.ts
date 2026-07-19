/** Initial persisted `data` payload for each Flow node type. */

import type { FlowNodeType } from '../../graph/types.js'

import {
  getDefaultGenerationData,
  getDefaultGenerationDataForNodeType,
  getGenerationMediaTypeForNode,
  isGenerationNodeType,
} from '../../generation/registry/index.js'

/** Initial persisted `data` payload for a freshly added node. */
export function getDefaultNodeData(type: FlowNodeType) {
  if (type === 'text')
    return { locked: false, text: '' }
  if (type === 'element')
    return { elementId: null, locked: false, selectedAssetIds: [] }
  if (isGenerationNodeType(type)) {
    return {
      ...(type === 'audioGeneration'
        ? getDefaultGenerationData(getGenerationMediaTypeForNode(type))
        : getDefaultGenerationDataForNodeType(type)),
      locked: false,
    }
  }
  return { locked: false }
}
