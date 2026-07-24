/** Sanitized history summaries derived from immutable generation-job requests. */

import type {
  PlannedJobRequestPayload,
  PromptTemplate,
} from '@talelabs/flows'

import { generationJobInputTargetSlotId, readFlowRunJobRequestPayload } from '@talelabs/flows'

/** Bounded media input facts safe for ordinary run-history presentation. */
export interface FlowRunRequestInputSummary {
  /** Canonical Asset identities captured for this semantic input slot. */
  assetIds: string[]
  /** Captured media families in provider-neutral input order. */
  mediaTypes: ('audio' | 'image' | 'video')[]
  /** Stable generation input-slot identity from the model contract. */
  slotId: string
}

/** Bounded provider-neutral request facts exposed in run list rows. */
export interface FlowRunRequestSummary {
  /** Bounded non-prompt inline fields retained for task-specific history reuse. */
  inline: Record<string, string>
  /** Captured input slots and canonical Asset identities. */
  inputs: FlowRunRequestInputSummary[]
  /** Output media family inferred from the planned generation node. */
  mediaType: 'audio' | 'image' | 'text' | 'video'
  /** Canonical creative model identity. */
  modelId: string
  /** Immutable catalog contract used by the saved generation node. */
  modelContractVersion: string
  /** Registered Flow node type selected by ordinary planning. */
  nodeType: string
  /** Catalog operation captured by the immutable plan. */
  operationId: string
  /** Expected sibling count for the representative request shard. */
  outputCount: number
  /** Narrow structured prompt fields, never editor JSON or provider payloads. */
  promptTemplates: Record<string, PromptTemplate>
  /** Provider-neutral catalog settings needed to explain the request. */
  settings: Record<string, boolean | number | string>
}

function requestInlineSummary(
  request: PlannedJobRequestPayload,
): Record<string, string> {
  return Object.fromEntries(
    ['instructions', 'lyrics'].flatMap((key) => {
      const value = request.inline[key]
      return typeof value === 'string' && value.length > 0
        ? [[key, value.slice(0, 16_000)] as const]
        : []
    }),
  )
}

function requestInputSummary(
  request: PlannedJobRequestPayload,
): FlowRunRequestInputSummary[] {
  const bySlot = new Map<string, FlowRunRequestInputSummary>()
  for (const input of request.inputs) {
    const targetSlotId = generationJobInputTargetSlotId(input)
    const summary: FlowRunRequestInputSummary = bySlot.get(targetSlotId) ?? {
      assetIds: [],
      mediaTypes: [],
      slotId: targetSlotId,
    }
    for (const item of input.items) {
      if (item.value.kind === 'text')
        continue
      for (const asset of item.value.assets) {
        if ('assetId' in asset)
          summary.assetIds.push(asset.assetId)
        if (asset.mediaType === 'audio'
          || asset.mediaType === 'image'
          || asset.mediaType === 'video') {
          summary.mediaTypes.push(asset.mediaType)
        }
      }
    }
    bySlot.set(targetSlotId, summary)
  }
  return [...bySlot.values()].slice(0, 16).map(summary => ({
    ...summary,
    assetIds: summary.assetIds.slice(0, 32),
    mediaTypes: summary.mediaTypes.slice(0, 32),
  }))
}

/**
 * Reads one representative generation request through its strict hash and
 * schema boundary. Invalid historical requests remain listable but do not
 * expose partially trusted presentation facts.
 */
export function requestSummaryFromJob(
  input: {
    /** Immutable output media family persisted for the representative job. */
    mediaType: 'audio' | 'image' | 'text' | 'video'
    /** Immutable Flow node type projected from the admitted snapshot. */
    nodeType: string
    /** Canonical hash covering the persisted provider-neutral request. */
    requestHash: string
    /** Persisted provider-neutral request admitted for the job. */
    requestPayload: unknown
  },
): FlowRunRequestSummary | null {
  try {
    const request = readFlowRunJobRequestPayload({
      requestHash: input.requestHash,
      requestPayload: input.requestPayload,
    })
    return {
      inline: requestInlineSummary(request),
      inputs: requestInputSummary(request),
      mediaType: input.mediaType,
      modelId: request.modelId,
      modelContractVersion: request.modelContractVersion,
      nodeType: input.nodeType,
      operationId: request.operationId,
      outputCount: request.outputCount,
      promptTemplates: { ...(request.promptTemplates ?? {}) },
      settings: { ...request.settings },
    }
  }
  catch {
    return null
  }
}
