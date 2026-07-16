import type { GenerationNodeType } from '../types.js'

import {
  ADAPTIVE_GENERATION_NODE_TYPES,
  GENERATION_NODE_MEDIA_TYPES,
} from '../contracts.js'

export function isAdaptiveGenerationNodeType(
  value: unknown,
): value is (typeof ADAPTIVE_GENERATION_NODE_TYPES)[number] {
  return typeof value === 'string'
    && (ADAPTIVE_GENERATION_NODE_TYPES as readonly string[]).includes(value)
}

export function isGenerationNodeType(
  value: unknown,
): value is GenerationNodeType {
  return typeof value === 'string' && value in GENERATION_NODE_MEDIA_TYPES
}

export function getGenerationMediaTypeForNode(type: GenerationNodeType) {
  return GENERATION_NODE_MEDIA_TYPES[type]
}
