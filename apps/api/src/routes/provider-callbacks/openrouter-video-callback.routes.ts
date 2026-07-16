/** Signed OpenRouter video callback route and durable wake-up boundary. */

import type { OpenAPIHono } from '@hono/zod-openapi'

import type { ApiEnv } from '../../types.js'
import process from 'node:process'
import { verifyOpenRouterWebhookSignature } from '@talelabs/providers/server'
import { recordOpenRouterVideoCompletion } from '@talelabs/trigger'
import { bodyLimit } from 'hono/body-limit'

const MAX_WEBHOOK_BYTES = 64 * 1024
const TERMINAL_STATUSES = new Set(['cancelled', 'completed', 'expired', 'failed'])

/** Registers the unauthenticated, signature-verified OpenRouter receiver. */
export function registerOpenRouterVideoCallbackRoutes(app: OpenAPIHono<ApiEnv>) {
  app.post(
    '/provider-callbacks/openrouter/video/:organizationId/:generationJobId',
    bodyLimit({
      maxSize: MAX_WEBHOOK_BYTES,
      onError: c => c.body(null, 413),
    }),
    async (c) => {
      const secret = process.env.OPENROUTER_WEBHOOK_SECRET
      if (!secret)
        return c.body(null, 503)
      const body = new Uint8Array(await c.req.arrayBuffer())
      const signature = c.req.header('x-openrouter-signature')
      if (!signature || !verifyOpenRouterWebhookSignature({ body, secret, signature }))
        return c.body(null, 401)

      let event: unknown
      try {
        event = JSON.parse(new TextDecoder().decode(body))
      }
      catch {
        return c.body(null, 400)
      }
      if (!event || typeof event !== 'object')
        return c.body(null, 400)
      const record = event as Record<string, unknown>
      const data = record.data
      if (!data || typeof data !== 'object')
        return c.body(null, 400)
      const payload = data as Record<string, unknown>
      if (
        typeof payload.id !== 'string'
        || typeof payload.status !== 'string'
        || !TERMINAL_STATUSES.has(payload.status)
        || record.type !== `video.generation.${payload.status}`
      ) {
        return c.body(null, 400)
      }
      const eventId = c.req.header('x-openrouter-idempotency-key')
      if (!eventId || eventId !== `${payload.id}-${payload.status}`)
        return c.body(null, 400)
      await recordOpenRouterVideoCompletion({
        eventId,
        externalJobId: payload.id,
        generationJobId: c.req.param('generationJobId'),
        organizationId: c.req.param('organizationId'),
        status: payload.status as 'cancelled' | 'completed' | 'expired' | 'failed',
      })
      return c.body(null, 204)
    },
  )
}
