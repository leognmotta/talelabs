/** Aggregation entry point for deterministic generation capability scenarios. */

import { validateGenerationAudioCapabilityScenarios } from './audio.js'
import { validateGenerationContractCapabilityScenarios } from './contracts.js'
import { validateGenerationResolverCapabilityScenarios } from './resolvers.js'

/** Runs all deterministic current-catalog capability scenarios. */
export function validateGenerationCapabilityScenarios() {
  return [
    ...validateGenerationContractCapabilityScenarios(),
    ...validateGenerationResolverCapabilityScenarios(),
    ...validateGenerationAudioCapabilityScenarios(),
  ]
}
