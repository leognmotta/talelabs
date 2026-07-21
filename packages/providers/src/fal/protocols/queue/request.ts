/** fal request-body construction from a reviewed request profile. */

import type { NormalizedGenerationRequest } from '@talelabs/flows'
import type {
  CatalogFalCombinedSettingParam,
  CatalogFalSettingParam,
} from '@talelabs/models-catalog'
import type { FalAssetResolver, FalQueueBinding } from '../../types.js'

import { throwProviderResponseInvalid } from '../../../generation-error.js'
import {
  assertOnlySettings,
  requestText,
} from '../../../generation-request.js'
import { applyFalInputMappings } from './inputs.js'

/** Maps captured settings onto their fal request fields with optional remap. */
function applySettingParams(
  body: Record<string, unknown>,
  request: NormalizedGenerationRequest,
  params: readonly CatalogFalSettingParam[],
) {
  for (const param of params) {
    if (
      param.sendWhen
      && request.settings[param.sendWhen.settingId] !== param.sendWhen.equals
    ) {
      continue
    }
    const value = request.settings[param.settingId]
    if (value === undefined)
      continue
    if (param.valueMap) {
      const mapped = param.valueMap[String(value)]
      if (mapped === undefined)
        throwProviderResponseInvalid()
      body[param.field] = mapped
    }
    else if (param.numberMultiplier !== undefined) {
      if (typeof value !== 'number')
        throwProviderResponseInvalid()
      body[param.field] = value * param.numberMultiplier
    }
    else {
      body[param.field] = value
    }
  }
}

/** Maps one reviewed enum-setting pair onto its single fal request field. */
function applyCombinedSettingParams(
  body: Record<string, unknown>,
  request: NormalizedGenerationRequest,
  params: readonly CatalogFalCombinedSettingParam[],
) {
  for (const param of params) {
    const [firstSettingId, secondSettingId] = param.settingIds
    const firstValue = request.settings[firstSettingId]
    const secondValue = request.settings[secondSettingId]
    if (firstValue === undefined || secondValue === undefined)
      throwProviderResponseInvalid()
    const mapped = param.valueMap[String(firstValue)]?.[String(secondValue)]
    if (mapped === undefined)
      throwProviderResponseInvalid()
    body[param.field] = mapped
  }
}

/** Builds one immutable fal queue request body for the captured operation. */
export async function buildFalRequestBody(input: {
  binding: FalQueueBinding
  request: NormalizedGenerationRequest
  resolveAsset: FalAssetResolver
}): Promise<Record<string, unknown>> {
  const profile = input.binding.requestProfile
  const body: Record<string, unknown> = { ...profile.staticParams }
  assertOnlySettings(input.request, profile.settingIds)
  if (profile.promptField)
    body[profile.promptField] = requestText(input.request)
  applySettingParams(body, input.request, profile.params)
  applyCombinedSettingParams(body, input.request, profile.combinedParams)

  if (profile.kind === 'image' && profile.requestedCountField)
    body[profile.requestedCountField] = input.request.outputCount
  else if (input.request.outputCount !== 1)
    throwProviderResponseInvalid()
  await applyFalInputMappings({
    body,
    profile,
    request: input.request,
    resolveAsset: input.resolveAsset,
  })
  return body
}
