import type { JsonValue } from '@talelabs/db'
import type { FlowRunPlanV1 } from '@talelabs/flows'

import { sql } from '@talelabs/db'
import { safeRunFailureForResponse } from '@talelabs/trigger'

export function safeFailureFields(
  errorCode: null | string,
  errorMessage: null | string,
) {
  const failure = safeRunFailureForResponse({ code: errorCode, message: errorMessage })
  return {
    errorCode: failure?.code ?? null,
    errorMessage: failure?.message ?? null,
  }
}

export function jsonb(value: JsonValue): JsonValue {
  return sql`${JSON.stringify(value)}::jsonb` as unknown as JsonValue
}

export function assetReferencesFromValue(value: unknown) {
  if (
    value
    && typeof value === 'object'
    && 'assets' in value
    && Array.isArray((value as { assets?: unknown }).assets)
  ) {
    return (value as { assets: readonly unknown[] }).assets.filter(
      (asset): asset is { assetId: string } => Boolean(
        asset
        && typeof asset === 'object'
        && 'assetId' in asset
        && typeof (asset as { assetId?: unknown }).assetId === 'string',
      ),
    )
  }
  return []
}

export function collectPlanPreExistingAssetIds(plan: FlowRunPlanV1) {
  const assetIds = new Set(plan.prerequisites.staticAssets.map(asset => asset.assetId))
  for (const node of plan.executionNodes) {
    for (const item of node.workItems) {
      for (const shard of item.requestShards) {
        for (const plannedInput of shard.requestPayload.inputs) {
          for (const runtimeItem of plannedInput.items) {
            for (const asset of assetReferencesFromValue(runtimeItem.value))
              assetIds.add(asset.assetId)
          }
        }
      }
    }
  }
  return [...assetIds].toSorted()
}

export function summaryFromPlan(plan: FlowRunPlanV1 & { planHash: string }) {
  return {
    flowId: plan.flowId,
    flowRevision: plan.flowRevision,
    planHash: plan.planHash,
    expectedOutputCount: plan.summary.expectedOutputCount,
    plannedExecutableCount: plan.summary.plannedExecutableCount,
    plannedItemCount: plan.summary.plannedItemCount,
    plannedJobCount: plan.summary.plannedJobCount,
    requestedExecutableCount: plan.summary.requestedExecutableCount,
    topologicalDepth: plan.summary.topologicalDepth,
  }
}

export function extractPlanSummary(run: { graphSnapshot: JsonValue }) {
  const snapshot = run.graphSnapshot as any
  const summary = snapshot?.plan?.summary ?? {}
  return {
    expectedOutputCount: Number(summary.expectedOutputCount ?? 0),
    plannedExecutableCount: Number(summary.plannedExecutableCount ?? 0),
    plannedItemCount: Number(summary.plannedItemCount ?? 0),
    plannedJobCount: Number(summary.plannedJobCount ?? 0),
  }
}
