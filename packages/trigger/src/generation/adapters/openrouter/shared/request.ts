import type {
  NormalizedGenerationMediaAsset,
  NormalizedGenerationRequest,
} from '@talelabs/flows'

import {
  GenerationProviderError,
  throwProviderResponseInvalid,
} from '../../errors.js'

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
