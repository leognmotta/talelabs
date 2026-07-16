import type { NormalizedGenerationProviderFacts } from '@talelabs/flows'
import type { ResolvedGenerationProviderAdapter } from '../contracts.js'
import type { GenerationProviderLifecycleResult } from './runner.js'

import { mergeGenerationProviderFacts } from './helpers.js'

export async function reconcileCompletedGenerationProviderFacts(input: {
  onFacts?: (facts: NormalizedGenerationProviderFacts) => Promise<void>
  resolvedAdapter: ResolvedGenerationProviderAdapter
  result: GenerationProviderLifecycleResult
}) {
  const reconcile = input.resolvedAdapter.adapter.reconcileFacts
  if (!reconcile)
    return input.result
  let reconciled: NormalizedGenerationProviderFacts | undefined
  try {
    reconciled = await reconcile(input.result.facts)
  }
  catch {
    return input.result
  }
  const facts = mergeGenerationProviderFacts(input.result.facts, reconciled)
  await input.onFacts?.(facts)
  return { ...input.result, facts }
}
