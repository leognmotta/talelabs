/**
 * Provider-neutral Flow graph, generation, planning, and snapshot contracts.
 *
 * @packageDocumentation
 */

import {
  GENERATION_MODEL_REGISTRY,
  validateHardenedGenerationRegistry,
} from './generation/registry/index.js'
import { validateGenerationCapabilityScenarios } from './generation/scenarios/capabilities.js'
import { validateFlowNodeRegistry } from './nodes/registry/index.js'

export * from './generation/contracts/provider.js'
export * from './generation/outputs/validation.js'
export * from './generation/registry/index.js'
export * from './generation/registry/presentations.js'
export * from './generation/resolution/adaptive.js'
export * from './generation/resolution/audio.js'
export * from './generation/resolution/evaluator.js'
export * from './generation/resolution/image-input-aliases.js'
export * from './generation/resolution/image.js'
export * from './generation/resolution/llm.js'
export * from './generation/resolution/music.js'
export * from './generation/resolution/setting-requirements.js'
export * from './generation/resolution/sound-effect.js'
export * from './generation/resolution/speech.js'
export * from './generation/resolution/video-inputs.js'
export * from './generation/resolution/video.js'
export * from './generation/resolution/voice-changer.js'
export * from './generation/resolution/voice-isolation.js'
export * from './generation/scenarios/capabilities.js'
export * from './graph/asset-value-types.js'
export * from './graph/handles.js'
export * from './graph/limits.js'
export * from './graph/ordering/edges.js'
export * from './graph/ordering/stable.js'
export * from './graph/types.js'
export {
  getElementNodeElementId,
  getElementNodeSelectedAssetIds,
  resolveElementNodeReferences,
  sourceCandidateAssetIds,
} from './graph/validation-nodes.js'
export * from './graph/validation.js'
export * from './nodes/registry/index.js'
export * from './prompts/contracts.js'
export * from './prompts/resolve.js'
export * from './prompts/schema.js'
export * from './runtime/index.js'

const startupErrors = [
  ...validateFlowNodeRegistry(),
  ...validateHardenedGenerationRegistry(GENERATION_MODEL_REGISTRY),
  ...validateGenerationCapabilityScenarios(),
]

if (startupErrors.length) {
  throw new Error(
    `Invalid Flow registry configuration:\n${startupErrors.join('\n')}`,
  )
}
