/** Offline fake-HTTP acceptance runner for current OpenRouter provider adapters. */

import { verifyDebugModeResolver } from './openrouter-provider-verifier/debug-mode.js'
import { verifyHttpBoundary } from './openrouter-provider-verifier/http-boundary.js'
import { verifyLifecycleRecovery } from './openrouter-provider-verifier/lifecycle-immediate-recovery.js'
import { verifyWebhookWakeBackoff } from './openrouter-provider-verifier/lifecycle-webhook-wake.js'
import { currentRoutes } from './openrouter-provider-verifier/routes.js'
import {
  verifyCurrentRouteScenarios,
  verifyNanoBanana2CanvasRequest,
  verifyProductionResolver,
} from './openrouter-provider-verifier/scenarios.js'
import { verifyVideoStreamBoundary } from './openrouter-provider-verifier/video-stream-boundary.js'
import { verifyWebhookSignatureBoundary } from './openrouter-provider-verifier/webhook-signature-boundary.js'

/** Runs every deterministic OpenRouter adapter and lifecycle scenario. */
export async function verifyOpenRouterProviderAdapters() {
  verifyProductionResolver()
  await verifyDebugModeResolver()
  await verifyCurrentRouteScenarios()
  await verifyNanoBanana2CanvasRequest()
  await verifyHttpBoundary()
  verifyWebhookSignatureBoundary()
  await verifyLifecycleRecovery()
  await verifyWebhookWakeBackoff()
  await verifyVideoStreamBoundary()
  return currentRoutes().length
}
