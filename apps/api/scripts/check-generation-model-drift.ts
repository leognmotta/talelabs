import type {
  GenerationModelDefinition,
  GenerationSettingDefinition,
} from '@talelabs/flows'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'

import {
  GENERATION_MODEL_CONTRACTS,
  getActiveGenerationSettings,
} from '@talelabs/flows'

import { GENERATION_PROVIDER_ROUTES } from '../src/routes/config/generation-provider-routes.js'

interface DiscoveryOperation {
  contractVersion: string
  endpoint: string
  modelId: string
  operationId: string
  productModelId: string
  provider: string
  publicContract: Record<string, unknown>
  supportedParameters: string[]
}

interface DiscoverySnapshot {
  capture: {
    capturedAt: string
    method: 'external'
    sources: string[]
  }
  operations: DiscoveryOperation[]
  providerModels: DiscoveryProviderModel[]
}

interface DiscoveryProviderModel {
  documentationUrl: string
  lifecycle: 'active' | 'deprecated' | 'removed'
  modelId: string
  provider: string
}

function parseSnapshot(value: unknown): DiscoverySnapshot {
  if (!value || typeof value !== 'object')
    throw new Error('Discovery snapshot must be an object')
  const snapshot = value as Partial<DiscoverySnapshot>
  if (
    snapshot.capture?.method !== 'external'
    || !snapshot.capture.capturedAt
    || !Array.isArray(snapshot.capture.sources)
    || snapshot.capture.sources.length === 0
    || snapshot.capture.sources.some(source => typeof source !== 'string')
  ) {
    throw new Error('Discovery snapshot must declare an external capture date and sources')
  }
  if (snapshot.capture.sources.some(source => new URL(source).protocol !== 'https:'))
    throw new Error('Discovery snapshot sources must use HTTPS')
  if (!Array.isArray(snapshot.operations))
    throw new Error('Discovery snapshot must contain an operations array')
  if (!Array.isArray(snapshot.providerModels))
    throw new Error('Discovery snapshot must contain a providerModels array')

  return {
    capture: snapshot.capture,
    operations: snapshot.operations.map((operation, index) => {
      if (
        !operation
        || typeof operation.contractVersion !== 'string'
        || typeof operation.endpoint !== 'string'
        || typeof operation.modelId !== 'string'
        || typeof operation.operationId !== 'string'
        || typeof operation.productModelId !== 'string'
        || typeof operation.provider !== 'string'
        || !operation.publicContract
        || typeof operation.publicContract !== 'object'
        || Array.isArray(operation.publicContract)
        || !Array.isArray(operation.supportedParameters)
        || operation.supportedParameters.some(parameter => typeof parameter !== 'string')
      ) {
        throw new Error(`Invalid discovery operation at index ${index}`)
      }
      return {
        ...operation,
        supportedParameters: [...operation.supportedParameters],
      }
    }),
    providerModels: snapshot.providerModels.map((model, index) => {
      if (
        !model
        || typeof model.documentationUrl !== 'string'
        || new URL(model.documentationUrl).protocol !== 'https:'
        || !['active', 'deprecated', 'removed'].includes(model.lifecycle)
        || typeof model.modelId !== 'string'
        || typeof model.provider !== 'string'
      ) {
        throw new Error(`Invalid discovery provider model at index ${index}`)
      }
      return { ...model }
    }),
  }
}

function serializeSetting(setting: GenerationSettingDefinition) {
  if (setting.kind === 'enum') {
    return {
      kind: setting.kind,
      values: setting.options.map(option => option.value),
    }
  }
  if (setting.kind === 'number') {
    return {
      kind: setting.kind,
      max: setting.max,
      min: setting.min,
      step: setting.step,
    }
  }
  if (setting.kind === 'string') {
    return {
      kind: setting.kind,
      maxLength: setting.maxLength,
    }
  }
  return { kind: setting.kind }
}

function operationPublicContract(
  model: GenerationModelDefinition,
  operationId: string,
) {
  const operation = model.operations.find(item => item.id === operationId)
  if (!operation)
    return null
  const inputSlotIds = new Set(operation.inputSlotIds)
  const settingIds = new Set(operation.settingIds)
  const constraints = model.constraints.filter((constraint) => {
    const conditions = [
      ...constraint.when,
      ...(constraint.require ?? []),
      ...(constraint.forbid ?? []),
    ]
    return conditions.every((condition) => {
      if (condition.field === 'operation')
        return condition.value === operation.id
      if (condition.field === 'setting')
        return settingIds.has(condition.id)
      return inputSlotIds.has(condition.id)
    })
  }).map(constraint => ({
    id: constraint.id,
    when: constraint.when,
    ...(constraint.require ? { require: constraint.require } : {}),
    ...(constraint.forbid ? { forbid: constraint.forbid } : {}),
  })).toSorted((left, right) => left.id.localeCompare(right.id))

  return {
    constraints,
    inputRequirements: Object.fromEntries(
      Object.entries(operation.inputs).map(([id, requirement]) => [
        id,
        {
          ...(requirement.required ? { required: true } : {}),
          ...(requirement.oneOf ? { oneOf: [...requirement.oneOf] } : {}),
        },
      ]),
    ),
    inputLimits: Object.fromEntries(model.inputSlots
      .filter(slot => inputSlotIds.has(slot.id))
      .map(slot => [slot.id, slot.maxItems])),
    requiredSettingIds: [...(operation.requiredSettingIds ?? [])].toSorted(),
    settings: Object.fromEntries(getActiveGenerationSettings(model, operation.id)
      .filter(setting => settingIds.has(setting.id))
      .map(setting => [setting.id, serializeSetting(setting)])),
  }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value))
    return value.map(canonicalize)
  if (!value || typeof value !== 'object')
    return value
  return Object.fromEntries(Object.entries(value)
    .toSorted(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => [key, canonicalize(item)]))
}

function contractsMatch(left: unknown, right: unknown) {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right))
}

function operationKey(input: {
  modelId: string
  operationId: string
  provider: string
}) {
  return `${input.provider}:${input.modelId}:${input.operationId}`
}

const snapshotArgument = process.argv.find(argument => argument.startsWith('--snapshot='))
const snapshotUrlArgument = process.argv.find(argument => argument.startsWith('--snapshot-url='))
if (Boolean(snapshotArgument) === Boolean(snapshotUrlArgument)) {
  throw new Error(
    'Pass exactly one externally refreshed --snapshot=<path> or --snapshot-url=<https-url>',
  )
}

let snapshotLocation: string
let snapshotValue: unknown
if (snapshotUrlArgument) {
  const url = new URL(snapshotUrlArgument.slice('--snapshot-url='.length))
  if (url.protocol !== 'https:')
    throw new Error('Remote discovery snapshots must use HTTPS')
  const response = await fetch(url, { headers: { accept: 'application/json' } })
  if (!response.ok)
    throw new Error(`Discovery snapshot request failed with ${response.status}`)
  snapshotValue = await response.json()
  snapshotLocation = url.toString()
}
else {
  const snapshotPath = resolve(
    process.cwd(),
    snapshotArgument!.slice('--snapshot='.length),
  )
  snapshotValue = JSON.parse(await readFile(snapshotPath, 'utf8'))
  snapshotLocation = snapshotPath
}

const snapshot = parseSnapshot(snapshotValue)
const capturedAt = new Date(snapshot.capture.capturedAt)
if (Number.isNaN(capturedAt.getTime()))
  throw new Error('Discovery snapshot capturedAt must be an ISO timestamp')
const maximumAgeMs = 120 * 24 * 60 * 60 * 1000
if (Date.now() - capturedAt.getTime() > maximumAgeMs)
  throw new Error('Discovery snapshot is older than 120 days and must be refreshed externally')

const discoveredByKey = new Map(snapshot.operations.map(operation => [
  operationKey(operation),
  operation,
]))
if (discoveredByKey.size !== snapshot.operations.length)
  throw new Error('Discovery snapshot contains duplicate operations')
const providerModelsByKey = new Map(snapshot.providerModels.map(model => [
  `${model.provider}:${model.modelId}`,
  model,
]))
if (providerModelsByKey.size !== snapshot.providerModels.length)
  throw new Error('Discovery snapshot contains duplicate provider models')
const drift: string[] = []

for (const route of GENERATION_PROVIDER_ROUTES) {
  const providerModel = providerModelsByKey.get(
    `${route.discovery.provider}:${route.discovery.modelId}`,
  )
  if (!providerModel) {
    drift.push(`${route.productModelId}/${route.operationId}: provider model is missing`)
  }
  else if (providerModel.lifecycle !== 'active') {
    drift.push(
      `${route.productModelId}/${route.operationId}: provider model is ${providerModel.lifecycle}`,
    )
  }
  const key = operationKey({
    modelId: route.discovery.modelId,
    operationId: route.operationId,
    provider: route.discovery.provider,
  })
  const discovered = discoveredByKey.get(key)
  if (!discovered) {
    drift.push(`${route.productModelId}/${route.operationId}: provider operation is missing`)
    continue
  }
  if (discovered.endpoint !== route.discovery.endpoint) {
    drift.push(
      `${route.productModelId}/${route.operationId}: endpoint changed from ${route.discovery.endpoint} to ${discovered.endpoint}`,
    )
  }
  if (discovered.productModelId !== route.productModelId) {
    drift.push(
      `${route.productModelId}/${route.operationId}: product model changed to ${discovered.productModelId}`,
    )
  }
  if (discovered.contractVersion !== route.modelContractVersion) {
    drift.push(
      `${route.productModelId}/${route.operationId}: snapshot contract ${discovered.contractVersion} does not match route ${route.modelContractVersion}`,
    )
  }
  const contractRegistry = GENERATION_MODEL_CONTRACTS[
    discovered.contractVersion as keyof typeof GENERATION_MODEL_CONTRACTS
  ]
  const publicModel = contractRegistry?.[route.productModelId]
  const publicContract = publicModel
    ? operationPublicContract(publicModel, route.operationId)
    : null
  if (!publicContract) {
    drift.push(
      `${route.productModelId}/${route.operationId}: public operation contract is missing`,
    )
  }
  else if (!contractsMatch(publicContract, discovered.publicContract)) {
    drift.push(
      `${route.productModelId}/${route.operationId}: public operation capabilities changed`,
    )
  }

  const discoveredParameters = new Set(discovered.supportedParameters)
  const expectedParameters = new Set<string>(route.discovery.supportedParameters)
  const removed = route.discovery.supportedParameters.filter(
    parameter => !discoveredParameters.has(parameter),
  )
  const added = discovered.supportedParameters.filter(
    parameter => !expectedParameters.has(parameter),
  )
  if (removed.length) {
    drift.push(
      `${route.productModelId}/${route.operationId}: parameters disappeared: ${removed.join(', ')}`,
    )
  }
  if (added.length) {
    drift.push(
      `${route.productModelId}/${route.operationId}: parameters appeared: ${added.join(', ')}`,
    )
  }
  discoveredByKey.delete(key)
}

for (const operation of discoveredByKey.values()) {
  drift.push(
    `${operation.provider}/${operation.modelId}/${operation.operationId}: unreviewed provider operation appeared`,
  )
}

if (drift.length) {
  console.error(`Generation model discovery drift detected:\n${drift.join('\n')}`)
  process.exitCode = 1
}
else {
  console.log(
    `No generation model discovery drift in externally refreshed snapshot ${snapshotLocation}`,
  )
}
