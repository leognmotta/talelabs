import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex } from '@noble/hashes/utils.js'

import { compareStableStrings } from '../stable-order.js'

export const CANONICAL_SERIALIZER_VERSION = 1 as const

export const FLOW_RUN_HASH_DOMAINS = Object.freeze({
  item: 'talelabs:run-item:v1',
  job: 'talelabs:run-job:v1',
  mockRequest: 'talelabs:mock-request:v1',
  plan: 'talelabs:run-plan:v1',
  request: 'talelabs:run-request:v1',
  snapshot: 'talelabs:run-snapshot:v1',
} as const)

const encoder = new TextEncoder()

export class CanonicalSerializationError extends TypeError {
  readonly path: string

  constructor(message: string, path: string) {
    super(`${message} at ${path}`)
    this.name = 'CanonicalSerializationError'
    this.path = path
  }
}

function framed(value: string) {
  return `${encoder.encode(value).byteLength}:${value}`
}

function serialize(
  value: unknown,
  path: string,
  ancestors: WeakSet<object>,
): string {
  if (value === null)
    return 'null;'
  if (typeof value === 'boolean')
    return value ? 'bool:1;' : 'bool:0;'
  if (typeof value === 'string')
    return `string:${framed(value)};`
  if (typeof value === 'number') {
    if (!Number.isFinite(value))
      throw new CanonicalSerializationError('Non-finite number', path)
    const normalized = Object.is(value, -0) ? 0 : value
    return `number:${JSON.stringify(normalized)};`
  }
  if (value === undefined)
    throw new CanonicalSerializationError('Unexpected undefined value', path)
  if (
    typeof value === 'bigint'
    || typeof value === 'function'
    || typeof value === 'symbol'
  ) {
    throw new CanonicalSerializationError(
      `Unsupported ${typeof value} value`,
      path,
    )
  }

  if (ancestors.has(value))
    throw new CanonicalSerializationError('Cyclic value', path)
  ancestors.add(value)

  try {
    if (Array.isArray(value)) {
      const entries = value.map((entry, index) => {
        if (!(index in value))
          throw new CanonicalSerializationError('Sparse array', `${path}[${index}]`)
        return serialize(entry, `${path}[${index}]`, ancestors)
      })
      return `array:${entries.length}:[${entries.join('')}]`
    }

    if (value instanceof Map) {
      const entries = [...value.entries()].map(([key, entryValue], index) => {
        const serializedKey = serialize(key, `${path}.<map-key:${index}>`, ancestors)
        const serializedValue = serialize(
          entryValue,
          `${path}.<map-value:${index}>`,
          ancestors,
        )
        return [serializedKey, serializedValue] as const
      }).toSorted(([leftKey, leftValue], [rightKey, rightValue]) =>
        compareStableStrings(leftKey, rightKey)
        || compareStableStrings(leftValue, rightValue))
      return `map:${entries.length}:{${entries
        .map(([key, entryValue]) => `${framed(key)}${framed(entryValue)}`)
        .join('')}}`
    }

    if (value instanceof Set) {
      const entries = [...value]
        .map((entry, index) =>
          serialize(entry, `${path}.<set:${index}>`, ancestors))
        .toSorted(compareStableStrings)
      return `set:${entries.length}:{${entries.map(framed).join('')}}`
    }

    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) {
      throw new CanonicalSerializationError(
        `Unsupported object type ${value.constructor?.name ?? 'unknown'}`,
        path,
      )
    }
    if (Object.getOwnPropertySymbols(value).length > 0)
      throw new CanonicalSerializationError('Symbol-keyed property', path)

    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .toSorted(([left], [right]) => compareStableStrings(left, right))
      .map(([key, entryValue]) => [
        key,
        serialize(entryValue, `${path}.${key}`, ancestors),
      ] as const)
    return `object:${entries.length}:{${entries
      .map(([key, entryValue]) => `${framed(key)}${framed(entryValue)}`)
      .join('')}}`
  }
  finally {
    ancestors.delete(value)
  }
}

/**
 * Produces the version-1 TaleLabs canonical serialization. Object keys and
 * unordered Map/Set members are normalized; array order remains significant.
 */
export function canonicalSerialize(value: unknown) {
  return serialize(value, '$', new WeakSet())
}

export function canonicalByteLength(value: unknown) {
  return encoder.encode(canonicalSerialize(value)).byteLength
}

export function hashCanonicalValue(domain: string, value: unknown) {
  const payload = [
    domain,
    `serializer:${CANONICAL_SERIALIZER_VERSION}`,
    canonicalSerialize(value),
  ].join('\n')
  return bytesToHex(sha256(encoder.encode(payload)))
}

export function hashFlowRunItem(value: unknown) {
  return hashCanonicalValue(FLOW_RUN_HASH_DOMAINS.item, value)
}

export function hashFlowRunJob(value: unknown) {
  return hashCanonicalValue(FLOW_RUN_HASH_DOMAINS.job, value)
}

export function hashFlowRunPlan(value: unknown) {
  return hashCanonicalValue(FLOW_RUN_HASH_DOMAINS.plan, value)
}

export function hashFlowRunRequest(value: unknown) {
  return hashCanonicalValue(FLOW_RUN_HASH_DOMAINS.request, value)
}

export function hashFlowRunSnapshot(value: unknown) {
  return hashCanonicalValue(FLOW_RUN_HASH_DOMAINS.snapshot, value)
}
