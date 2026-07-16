/** Exact pre-existing Asset prerequisite extraction from immutable run plans. */

import type { FlowRunPlan } from '@talelabs/flows'

/** Reads valid Asset references from one provider-neutral runtime value. */
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

/** Collects every pre-existing Asset locked by an admitted plan. */
export function collectPlanPreExistingAssetIds(plan: FlowRunPlan) {
  const assetIds = new Set(
    plan.prerequisites.staticAssets.map(asset => asset.assetId),
  )
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
