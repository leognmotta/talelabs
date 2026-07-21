/** Offline settlement and staged-object recovery assertions. */

import assert from 'node:assert/strict'

import { completedProviderSettlement } from '../src/flow-runs/execution/provider-results/settlement.js'
import { inspectStagedProviderObject } from '../src/flow-runs/execution/provider-results/storage-recovery.js'
import { runProviderAccountingBudget } from '../src/flow-runs/reconciliation/provider-accounting-budget.js'

const completedAt = new Date('2026-07-20T12:00:00.000Z')
assert.deepEqual(completedProviderSettlement({
  providerCostUsd: 0.00135,
  providerGenerationId: 'provider-generation-known-cost',
}, completedAt), {
  providerSettlementResolvedAt: completedAt,
  providerSettlementStatus: 'settled',
})
assert.deepEqual(completedProviderSettlement({
  providerGenerationId: 'provider-generation-eventual-cost',
}, completedAt), {
  providerSettlementResolvedAt: null,
  providerSettlementStatus: 'pending',
})
assert.deepEqual(completedProviderSettlement({}, completedAt), {
  providerSettlementResolvedAt: completedAt,
  providerSettlementStatus: 'unknown',
})

const remainingDrainChecks = [10, 10, 3]
assert.deepEqual(await runProviderAccountingBudget({
  maxChecks: 50,
  now: () => 0,
  pageSize: 10,
  reconcilePage: async () => {
    const checked = remainingDrainChecks.shift() ?? 0
    return {
      checked,
      failed: 0,
      recovered: checked,
      unavailable: 0,
      unknown: 0,
    }
  },
  timeBudgetMs: 1_000,
}), {
  budgetExhausted: false,
  checked: 23,
  failed: 0,
  pages: 3,
  recovered: 23,
  unavailable: 0,
  unknown: 0,
})

assert.deepEqual(await runProviderAccountingBudget({
  maxChecks: 25,
  now: () => 0,
  pageSize: 10,
  reconcilePage: async limit => ({
    checked: limit,
    failed: 0,
    recovered: limit,
    unavailable: 0,
    unknown: 0,
  }),
  timeBudgetMs: 1_000,
}), {
  budgetExhausted: true,
  checked: 25,
  failed: 0,
  pages: 3,
  recovered: 25,
  unavailable: 0,
  unknown: 0,
})

let accountingNow = 0
assert.deepEqual(await runProviderAccountingBudget({
  maxChecks: 50,
  now: () => accountingNow,
  pageSize: 10,
  reconcilePage: async (limit) => {
    accountingNow += 60
    return {
      checked: limit,
      failed: 0,
      recovered: limit,
      unavailable: 0,
      unknown: 0,
    }
  },
  timeBudgetMs: 100,
}), {
  budgetExhausted: true,
  checked: 20,
  failed: 0,
  pages: 2,
  recovered: 20,
  unavailable: 0,
  unknown: 0,
})

const descriptor = {
  mimeType: 'video/mp4',
  storageBucket: 'generated-output',
  storageKey: 'organizations/test/assets/recoverable.mp4',
}

assert.equal(await inspectStagedProviderObject(
  descriptor,
  async () => ({
    $metadata: {},
    ContentLength: 42,
    ContentType: 'video/mp4',
  }),
), true)

assert.equal(await inspectStagedProviderObject(
  descriptor,
  async () => {
    throw Object.assign(new Error('missing'), {
      $metadata: { httpStatusCode: 404 },
      name: 'NotFound',
    })
  },
), false)

await assert.rejects(
  inspectStagedProviderObject(
    descriptor,
    async () => ({
      $metadata: {},
      ContentLength: 0,
      ContentType: 'video/mp4',
    }),
  ),
  /generation_provider_checkpoint_object_invalid/,
)

await assert.rejects(
  inspectStagedProviderObject(
    descriptor,
    async () => ({
      $metadata: {},
      ContentLength: 42,
      ContentType: 'application/octet-stream',
    }),
  ),
  /generation_provider_checkpoint_object_invalid/,
)

console.log('Provider output recovery verification passed.')
