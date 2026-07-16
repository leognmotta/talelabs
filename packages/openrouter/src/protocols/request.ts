/**
 * Provider-neutral request accessors shared by OpenRouter protocols.
 *
 */

import type {
  NormalizedGenerationMediaAsset,
  NormalizedGenerationRequest,
} from '@talelabs/flows'

import { GenerationProviderError, throwProviderResponseInvalid } from '../errors.js'

/** Reads one required normalized text slot. */
export function requestText(
  request: NormalizedGenerationRequest,
  slotId = 'prompt',
) {
  const text = request.textSlots.find(
    slot => slot.slotId === slotId,
  )?.resolvedText.trim()
  if (!text)
    throwProviderResponseInvalid()
  return text
}

/** Rejects settings outside the captured protocol profile. */
export function assertOnlySettings(
  request: NormalizedGenerationRequest,
  allowed: readonly string[],
) {
  const allowedSet = new Set(allowed)
  if (Object.keys(request.settings).some(settingId => !allowedSet.has(settingId))) {
    throw new GenerationProviderError({
      code: 'provider_rejected',
      retryable: false,
    })
  }
}

/** Returns media assets for one slot in deterministic edge/item/asset order. */
export function inputAssets(
  request: NormalizedGenerationRequest,
  targetSlotId: string,
): readonly NormalizedGenerationMediaAsset[] {
  return request.orderedInputs
    .filter(input => input.targetSlotId === targetSlotId)
    .toSorted((left, right) => left.order - right.order)
    .flatMap(input => input.items.flatMap(
      item => [...item.assets].toSorted(
        (left, right) => left.order - right.order,
      ),
    ))
}
