import { validateGenerationCapabilityScenarios } from './generation-capability-scenarios.js'
import {
  GENERATION_MODEL_CONTRACT_VERSION,
  GENERATION_MODEL_CONTRACTS,
  validateGenerationRegistry,
  validateHardenedGenerationRegistry,
} from './generation-registry.js'
import { validateFlowNodeRegistry } from './node-registry.js'

export * from './adaptive-generation-resolver.js'
export * from './audio-node-resolver.js'
export * from './edge-ordering.js'
export * from './generation-capability-scenarios.js'
export * from './generation-evaluator.js'
export * from './generation-model-presentations.js'
export * from './generation-provider-contracts.js'
export * from './generation-provider-output-validation.js'
export * from './generation-registry.js'
export * from './graph-validation.js'
export * from './handles.js'
export * from './image-generation-resolver.js'
export * from './limits.js'
export * from './llm-resolver.js'
export * from './music-generation-resolver.js'
export * from './node-registry.js'
export * from './reference-budget.js'
export * from './runtime/index.js'
export * from './sound-effect-generation-resolver.js'
export * from './speech-generation-resolver.js'
export * from './stable-order.js'
export * from './types.js'
export * from './video-generation-resolver.js'
export * from './voice-changer-resolver.js'
export * from './voice-isolation-resolver.js'

const startupErrors = [
  ...validateFlowNodeRegistry(),
  ...Object.entries(GENERATION_MODEL_CONTRACTS).flatMap(([version, registry]) =>
    (version === GENERATION_MODEL_CONTRACT_VERSION
      ? validateHardenedGenerationRegistry(registry)
      : validateGenerationRegistry(registry)
    ).map(error => `${version}: ${error}`),
  ),
  ...validateGenerationCapabilityScenarios(),
]

if (startupErrors.length) {
  throw new Error(
    `Invalid Flow registry configuration:\n${startupErrors.join('\n')}`,
  )
}
