/**
 * Projection of provider-neutral Flow plan shards onto provider-cost facts.
 *
 * Same-run values receive conservative metadata predictions from their
 * topologically earlier producer so a complete graph can be quoted pre-run.
 */

import type {
  ExecutionPlan,
  PlannedJobRequestPayload,
} from '@talelabs/flows'
import type {
  ProviderCostInputAsset,
  ProviderCostRequest,
} from '@talelabs/providers/server'

import {
  generationJobInputTargetSlotId,
  promptTemplateResolvedText,
  selectedProviderRequestInputs,
} from '@talelabs/flows'

/** Provider-cost request facts before a candidate binding is attached. */
export interface PlannedProviderCostJob {
  /** Stable planner hash used to associate the selected quote with persistence. */
  jobKey: string
  /** Provider-neutral request facts shared by every candidate binding. */
  request: Omit<ProviderCostRequest, 'binding'>
}

/** Planned jobs grouped under one execution step and its selected route. */
export interface PlannedProviderCostNode {
  /** Every provider request shard emitted for the node. */
  jobs: readonly PlannedProviderCostJob[]
  /** Canonical creative model ID. */
  modelId: string
  /** Stable source-neutral execution-step ID. */
  stepId: string
  /** Provider-neutral model operation. */
  operationId: string
}

interface PredictedOutput {
  durationSeconds: string | null
  height: number | null
  mediaType: 'audio' | 'image' | 'text' | 'video'
  textCharacterCount: number | null
  width: number | null
}

function outputKey(stepId: string, itemKey: string): string {
  return `${stepId}\u0000${itemKey}`
}

function expectedTextOutputCharacters(settings: Readonly<Record<string, boolean | number | string>>): number {
  const outputTokens = {
    auto: 2048,
    long: 8192,
    medium: 2048,
    short: 512,
  }[String(settings.responseLength ?? 'auto')] ?? 2048
  return outputTokens * 4
}

function textCharacterCount(input: {
  payload: PlannedJobRequestPayload
  predictions: ReadonlyMap<string, PredictedOutput>
}): { count: number, unresolved: boolean } {
  const connectedBySlot = new Map<string, number>()
  let unresolved = false
  for (const plannedInput of input.payload.inputs) {
    const targetSlotId = generationJobInputTargetSlotId(plannedInput)
    for (const runtimeItem of plannedInput.items) {
      if (runtimeItem.value.kind !== 'text')
        continue
      let count = runtimeItem.value.text?.length
      if (count === null || count === undefined) {
        const origin = runtimeItem.value.origin
        const prediction = origin.source === 'sameRunOutput'
          ? input.predictions.get(outputKey(origin.nodeId, origin.itemKey))
          : undefined
        count = prediction?.textCharacterCount ?? undefined
      }
      if (count === undefined) {
        unresolved = true
        count = expectedTextOutputCharacters({ responseLength: 'auto' })
      }
      connectedBySlot.set(
        targetSlotId,
        (connectedBySlot.get(targetSlotId) ?? 0) + count,
      )
    }
  }
  const slotIds = new Set([
    ...Object.keys(input.payload.inline),
    ...Object.keys(input.payload.promptTemplates ?? {}),
    ...connectedBySlot.keys(),
  ])
  return {
    count: [...slotIds].reduce((total, slotId) => total + (
      connectedBySlot.get(slotId)
      ?? (input.payload.promptTemplates?.[slotId]
        ? promptTemplateResolvedText(input.payload.promptTemplates[slotId]).length
        : input.payload.inline[slotId]?.length)
      ?? 0
    ), 0),
    unresolved,
  }
}

function plannedInputAssets(input: {
  assetsById: ReadonlyMap<string, ProviderCostInputAsset>
  payload: PlannedJobRequestPayload
  predictions: ReadonlyMap<string, PredictedOutput>
}): { assets: ProviderCostInputAsset[], unresolved: boolean } {
  const assets: ProviderCostInputAsset[] = []
  let unresolved = false
  for (const plannedInput of selectedProviderRequestInputs(input.payload)) {
    for (const runtimeItem of plannedInput.items) {
      if (runtimeItem.value.kind === 'text')
        continue
      for (const assetReference of runtimeItem.value.assets) {
        if (assetReference.mediaType === 'document') {
          unresolved = true
          continue
        }
        if (assetReference.source === 'sameRunOutput') {
          const prediction = input.predictions.get(outputKey(
            assetReference.nodeId,
            assetReference.itemKey,
          ))
          unresolved ||= !prediction
          assets.push({
            assetId: `same-run:${assetReference.nodeId}:${assetReference.itemKey}:${assetReference.outputIndex}`,
            durationSeconds: prediction?.durationSeconds ?? null,
            height: prediction?.height ?? null,
            mediaType: assetReference.mediaType,
            width: prediction?.width ?? null,
          })
          continue
        }
        const asset = input.assetsById.get(assetReference.assetId)
        unresolved ||= !asset
        assets.push(asset ?? {
          assetId: assetReference.assetId,
          durationSeconds: null,
          height: null,
          mediaType: assetReference.mediaType,
          width: null,
        })
      }
    }
  }
  return { assets, unresolved }
}

function predictedImageDimensions(
  settings: Readonly<Record<string, boolean | number | string>>,
): { height: number, width: number } {
  const resolution = String(settings.resolution ?? '1k').toLowerCase()
  const edge = resolution === '4k' ? 4096 : resolution === '2k' ? 2048 : 1024
  const match = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(String(settings.aspectRatio ?? '1:1'))
  if (!match)
    return { height: edge, width: edge }
  const widthRatio = Number(match[1])
  const heightRatio = Number(match[2])
  return widthRatio >= heightRatio
    ? { height: Math.max(1, Math.round(edge * heightRatio / widthRatio)), width: edge }
    : { height: edge, width: Math.max(1, Math.round(edge * widthRatio / heightRatio)) }
}

function predictionForJob(input: {
  assets: readonly ProviderCostInputAsset[]
  step: ExecutionPlan['steps'][number]
  textCharacterCount: number
}): PredictedOutput | undefined {
  const outputValueType = input.step.outputValueType
  if (outputValueType === 'Text') {
    return {
      durationSeconds: null,
      height: null,
      mediaType: 'text',
      textCharacterCount: expectedTextOutputCharacters(input.step.settings),
      width: null,
    }
  }
  if (outputValueType === 'ImageSet') {
    const dimensions = predictedImageDimensions(input.step.settings)
    return {
      durationSeconds: null,
      ...dimensions,
      mediaType: 'image',
      textCharacterCount: null,
    }
  }
  if (outputValueType === 'VideoSet') {
    return {
      durationSeconds: String(input.step.settings.durationSeconds ?? 6),
      height: null,
      mediaType: 'video',
      textCharacterCount: null,
      width: null,
    }
  }
  if (outputValueType !== 'AudioSet')
    return undefined
  const configuredDuration = Number(input.step.settings.duration)
  const inputDuration = input.assets.find(asset => (
    asset.mediaType === 'audio' || asset.mediaType === 'video'
  ))?.durationSeconds
  const duration = input.step.operationId === 'textToSpeech'
    ? Math.max(1, input.textCharacterCount / 15)
    : Number.isFinite(configuredDuration) && configuredDuration > 0
      ? configuredDuration
      : Number(inputDuration ?? 30)
  return {
    durationSeconds: String(duration),
    height: null,
    mediaType: 'audio',
    textCharacterCount: null,
    width: null,
  }
}

/** Builds cost facts for every planned provider request shard. */
export function plannedProviderCostNodes(input: {
  /** Existing Asset metadata keyed by canonical Asset ID. */
  assetsById: ReadonlyMap<string, ProviderCostInputAsset>
  /** Provider-neutral immutable execution plan. */
  plan: ExecutionPlan
}): PlannedProviderCostNode[] {
  const predictions = new Map<string, PredictedOutput>()
  const result: PlannedProviderCostNode[] = []
  for (const step of input.plan.steps) {
    const jobs: PlannedProviderCostJob[] = []
    for (const item of step.workItems) {
      for (const shard of item.requestShards) {
        const text = textCharacterCount({
          payload: shard.requestPayload,
          predictions,
        })
        const assets = plannedInputAssets({
          assetsById: input.assetsById,
          payload: shard.requestPayload,
          predictions,
        })
        jobs.push({
          jobKey: shard.jobHash,
          request: {
            hasUnresolvedInputs: text.unresolved || assets.unresolved,
            inputAssets: assets.assets,
            modelId: step.modelId,
            operationId: step.operationId,
            outputCount: shard.requestPayload.outputCount,
            settings: shard.requestPayload.settings,
            textCharacterCount: text.count,
          },
        })
        const prediction = predictionForJob({
          assets: assets.assets,
          step,
          textCharacterCount: text.count,
        })
        if (prediction)
          predictions.set(outputKey(step.stepId, item.itemKey), prediction)
      }
    }
    result.push({
      jobs,
      modelId: step.modelId,
      operationId: step.operationId,
      stepId: step.stepId,
    })
  }
  return result
}
