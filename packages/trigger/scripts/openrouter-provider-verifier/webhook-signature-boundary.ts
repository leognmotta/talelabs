/** Verifies OpenRouter webhook signature acceptance and rejection offline. */

import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { verifyOpenRouterWebhookSignature } from '@talelabs/providers/server'

/** Verifies valid, altered, and stale OpenRouter webhook signatures. */
export function verifyWebhookSignatureBoundary() {
  const body = new TextEncoder().encode('{"status":"completed"}')
  const secret = 'verification-secret'
  const timestamp = '1784124000'
  const digest = createHmac('sha256', secret)
    .update(`${timestamp},`)
    .update(body)
    .digest('hex')
  assert.equal(verifyOpenRouterWebhookSignature({
    body,
    now: new Date(Number(timestamp) * 1_000),
    secret,
    signature: `t=${timestamp},v1=${digest}`,
  }), true)
  assert.equal(verifyOpenRouterWebhookSignature({
    body,
    now: new Date((Number(timestamp) + 301) * 1_000),
    secret,
    signature: `t=${timestamp},v1=${digest}`,
  }), false)
}
