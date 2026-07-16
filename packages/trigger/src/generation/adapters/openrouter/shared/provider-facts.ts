import type { NormalizedGenerationProviderFacts } from '@talelabs/flows'

export function safeProviderCost(value: unknown) {
  const numeric = typeof value === 'string' ? Number(value) : value
  return typeof numeric === 'number'
    && Number.isFinite(numeric)
    && numeric >= 0
    && numeric <= 999_999.999_999
    ? numeric
    : undefined
}

export function providerFacts(input: {
  generationId?: null | string
  providerCostUsd?: unknown
}): NormalizedGenerationProviderFacts | undefined {
  const providerCostUsd = safeProviderCost(input.providerCostUsd)
  const candidateGenerationId = input.generationId?.trim() || undefined
  const providerGenerationId
    = candidateGenerationId && candidateGenerationId.length <= 512
      ? candidateGenerationId
      : undefined
  if (providerCostUsd === undefined && providerGenerationId === undefined)
    return undefined
  return {
    ...(providerCostUsd === undefined ? {} : { providerCostUsd }),
    ...(providerGenerationId === undefined ? {} : { providerGenerationId }),
  }
}
