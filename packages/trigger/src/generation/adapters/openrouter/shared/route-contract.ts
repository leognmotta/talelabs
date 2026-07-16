import type {
  GenerationOutputType,
  NormalizedGenerationRequest,
} from '@talelabs/flows'

import type { PinnedGenerationProviderRoute } from '../../contracts.js'
import { getGenerationModel } from '@talelabs/flows'
import { throwProviderResponseInvalid } from '../../errors.js'

/** Verifies the immutable normalized request against its pinned route once. */
export function assertOpenRouterRequestMatchesRoute(input: {
  mediaType: GenerationOutputType
  request: NormalizedGenerationRequest
  route: Readonly<PinnedGenerationProviderRoute>
}) {
  const model = getGenerationModel(
    input.route.productModelId,
    input.route.modelContractVersion,
  )
  const operation = model?.operations.find(
    candidate => candidate.id === input.route.operationId,
  )
  const outputCount = operation?.output?.count
  if (
    !model
    || !operation
    || model.mediaType !== input.mediaType
    || input.route.outputType !== input.mediaType
    || input.request.productModelId !== input.route.productModelId
    || input.request.modelContractVersion !== input.route.modelContractVersion
    || input.request.operationId !== input.route.operationId
    || !outputCount
    || input.request.outputCount < outputCount.min
    || input.request.outputCount > outputCount.max
  ) {
    throwProviderResponseInvalid()
  }
  return { model, operation }
}
