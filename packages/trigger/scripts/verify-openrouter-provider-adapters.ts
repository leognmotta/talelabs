import assert from 'node:assert/strict'
import {
  GENERATION_PROVIDER_ROUTES,
  validateGenerationProviderRoutes,
} from '@talelabs/openrouter'
import {
  verifyHttpBoundary,
} from './openrouter-provider-verifier/http-boundary.js'
import { verifyLifecycleRecovery } from './openrouter-provider-verifier/lifecycle-immediate-recovery.js'
import { verifyWebhookWakeBackoff } from './openrouter-provider-verifier/lifecycle-webhook-wake.js'
import {
  verifyCurrentRouteScenarios,
  verifyNanoBanana2CanvasRequest,
  verifyProductionResolver,
} from './openrouter-provider-verifier/scenarios.js'
import { verifyVideoStreamBoundary } from './openrouter-provider-verifier/video-stream-boundary.js'
import { verifyWebhookSignatureBoundary } from './openrouter-provider-verifier/webhook-signature-boundary.js'

assert.deepEqual(validateGenerationProviderRoutes(), [])
verifyProductionResolver()
await verifyCurrentRouteScenarios()
await verifyNanoBanana2CanvasRequest()
await verifyHttpBoundary()
verifyWebhookSignatureBoundary()
await verifyLifecycleRecovery()
await verifyWebhookWakeBackoff()
await verifyVideoStreamBoundary()

console.log(
  `Verified ${GENERATION_PROVIDER_ROUTES.length} production routes and every current OpenRouter adapter scenario with fake HTTP.`,
)
