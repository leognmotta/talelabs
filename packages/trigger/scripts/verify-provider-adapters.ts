/** Provider-neutral offline acceptance gate for every current real adapter. */

import { verifyFalAccountingLookup } from './fal-provider-verifier/accounting-scenario.js'
import { verifyElevenLabsRequestProfiles } from './fal-provider-verifier/elevenlabs-scenarios.js'
import {
  verifyFalCancellationSemantics,
  verifyFalErrorNormalization,
  verifyFalInputMappingBoundary,
  verifyFalManagedCancellationLifecycle,
  verifyFalMediaTransportBoundary,
  verifyFalProviderAdapters,
  verifyFalTerminalErrorClassification,
  verifySeedream5RequestProfiles,
} from './fal-provider-verifier/scenarios.js'
import { verifyOpenRouterProviderAdapters } from './verify-openrouter-provider-adapters.js'

const openRouterBindings = await verifyOpenRouterProviderAdapters()
const falBindings = await verifyFalProviderAdapters()
await verifyFalCancellationSemantics()
await verifyFalManagedCancellationLifecycle()
await verifyFalTerminalErrorClassification()
await verifyFalAccountingLookup()
await verifyFalErrorNormalization()
await verifyFalInputMappingBoundary()
await verifyFalMediaTransportBoundary()
await verifySeedream5RequestProfiles()
await verifyElevenLabsRequestProfiles()

console.log(
  `Verified ${openRouterBindings + falBindings} catalog bindings across OpenRouter and fal with fake HTTP.`,
)
