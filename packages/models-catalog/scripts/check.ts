/**
 * Offline acceptance check for the current model catalog.
 *
 * The command proves structural parsing, cross-record invariants, operation
 * coverage, retired-model exclusion, and public projection privacy without
 * contacting OpenRouter or any paid provider.
 *
 */

import { createHash } from 'node:crypto'

import { RAW_MODEL_CATALOG } from '../src/catalog-source.js'
import {
  MODEL_CATALOG,
  PUBLIC_MODEL_CATALOG,
  SELECTABLE_CATALOG_MODELS,
  validateModelCatalog,
} from '../src/index.js'

function canonicalJson(value: unknown): string {
  if (Array.isArray(value))
    return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .toSorted(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

function browserVerificationHash(binding: Record<string, unknown>) {
  const {
    browserVerification: _browserVerification,
    costCapture: _costCapture,
    evidence: _evidence,
    executionRuntimes: _executionRuntimes,
    priority: _priority,
    ...browserExecutionFacts
  } = binding
  return `sha256:${createHash('sha256')
    .update(canonicalJson(browserExecutionFacts))
    .digest('hex')}`
}

const errors = validateModelCatalog(MODEL_CATALOG)
let browserBindingCount = 0
for (const model of MODEL_CATALOG.models) {
  for (const binding of model.bindings) {
    if (!binding.executionRuntimes.includes('browser'))
      continue
    browserBindingCount += 1
    const expectedHash = browserVerificationHash(
      binding as unknown as Record<string, unknown>,
    )
    if (binding.browserVerification?.bindingHash !== expectedHash) {
      errors.push(
        `${model.id}/${binding.operationId}: browser verification hash must be ${expectedHash}`,
      )
    }
  }
}
const { catalogRevision: _declaredRevision, ...revisionSource }
  = RAW_MODEL_CATALOG
const expectedCatalogRevision = `sha256:${createHash('sha256')
  .update(canonicalJson(revisionSource))
  .digest('hex')}`
if (MODEL_CATALOG.catalogRevision !== expectedCatalogRevision) {
  errors.push(
    `catalogRevision must be ${expectedCatalogRevision}`,
  )
}
const publicJson = JSON.stringify(PUBLIC_MODEL_CATALOG)
for (const privateField of [
  'adapterVersion',
  'bindings',
  'browserVerification',
  'endpoint',
  'nativeModelId',
  'providerTag',
  'requestProfile',
  'supportedParameters',
]) {
  if (publicJson.includes(`\"${privateField}\"`))
    errors.push(`public projection exposes private field ${privateField}`)
}
if (SELECTABLE_CATALOG_MODELS.some(model => model.status !== 'active'))
  errors.push('selectable projection contains a non-active model')
if (PUBLIC_MODEL_CATALOG.models.some(model => model.status === 'retired'))
  errors.push('public projection contains a retired model')

if (errors.length)
  throw new Error(`Model catalog check failed:\n${errors.join('\n')}`)

const operationCount = MODEL_CATALOG.models.reduce(
  (count, model) => count + model.operations.length,
  0,
)
console.log(
  `Validated ${MODEL_CATALOG.models.length} models, ${operationCount} operations, ${browserBindingCount} exact browser bindings, and sanitized public projection.`,
)
