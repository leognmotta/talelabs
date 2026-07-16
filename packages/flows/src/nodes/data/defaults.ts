import type { FlowNodeType } from '../../graph/types.js'

import {
  getDefaultGenerationData,
  getDefaultGenerationDataForNodeType,
  getGenerationMediaTypeForNode,
  isGenerationNodeType,
} from '../../generation/registry/index.js'

export function getDefaultNodeData(type: FlowNodeType) {
  if (type === 'text')
    return { locked: false, text: '' }
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
