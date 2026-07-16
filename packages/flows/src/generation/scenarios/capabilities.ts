import { validateGenerationAudioCapabilityScenarios } from './audio.js'
import { validateGenerationContractCapabilityScenarios } from './contracts.js'
import { validateGenerationHistoryCapabilityScenarios } from './history.js'
import { validateGenerationResolverCapabilityScenarios } from './resolvers.js'

export function validateGenerationCapabilityScenarios() {
  return [
    ...validateGenerationContractCapabilityScenarios(),
    ...validateGenerationResolverCapabilityScenarios(),
    ...validateGenerationAudioCapabilityScenarios(),
    ...validateGenerationHistoryCapabilityScenarios(),
  ]
}
