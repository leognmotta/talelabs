/**
 * Projection of one browser-local Create draft into the public direct API.
 *
 * This contains no Flow graph, node, edge, revision, provider binding, or
 * credential. The server independently validates and recompiles every fact.
 */

import type { CreateDirectRunRequest } from '@talelabs/sdk'
import type { CreateDraft } from './create-draft'
import type { CreateDraftResolution } from './create-resolution'

function operationOutputCount(
  resolution: CreateDraftResolution,
): null | number {
  const operation = resolution.model?.operations.find(
    item => item.id === resolution.resolvedOperationId,
  )
  const count = operation?.output?.count
  if (!count)
    return null
  const configured = count.settingId
    ? resolution.settings[count.settingId]
    : count.default
  return typeof configured === 'number' && Number.isSafeInteger(configured)
    ? configured
    : count.default
}

function acceptsStructuredPrompt(draft: CreateDraft) {
  return draft.mode !== 'audio'
    || !['voiceChanger', 'voiceIsolation'].includes(draft.audioIntent)
}

/** Builds the bounded direct request shared by estimate and admission calls. */
export function createDirectRequest(input: {
  /** Browser providers with locally usable credentials. */
  byokProviders: readonly ('fal' | 'openrouter')[]
  /** Current local editable request. */
  draft: CreateDraft
  /** Paid-boundary policy for the next run. */
  executionMode: 'debug' | 'live'
  /** Existing provider execution driver. */
  executionRuntime: 'browser' | 'managed'
  /** Existing cross-surface funding preference. */
  fundingSource: 'byok' | 'credits'
  /** Current catalog resolution of the local request. */
  resolution: CreateDraftResolution
}): CreateDirectRunRequest | null {
  const outputCount = operationOutputCount(input.resolution)
  if (
    input.resolution.readiness !== 'ready'
    || !input.resolution.promptValid
    || !input.resolution.model
    || !input.resolution.resolvedOperationId
    || outputCount === null
  ) {
    return null
  }
  return {
    ...(input.draft.mode === 'audio'
      ? { audioIntent: input.draft.audioIntent }
      : {}),
    ...(input.executionRuntime === 'browser'
      ? { byokProviders: [...input.byokProviders] }
      : {}),
    executionMode: input.executionMode,
    executionRuntime: input.executionRuntime,
    fundingSource: input.fundingSource,
    inline: input.draft.audioIntent === 'musicGeneration'
      && input.draft.mode === 'audio'
      ? { lyrics: input.draft.lyrics }
      : {},
    inputs: input.draft.attachments.map(attachment => ({
      assetId: attachment.asset.id,
      slotId: attachment.slotId,
    })),
    mediaMode: input.draft.mode,
    modelContractVersion: input.draft.modelContractVersion,
    modelId: input.draft.modelId,
    operationId: input.resolution.resolvedOperationId,
    outputCount,
    promptTemplates: acceptsStructuredPrompt(input.draft)
      ? { prompt: input.draft.prompt }
      : {},
    settings: { ...input.resolution.settings },
  }
}
