import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex } from '@noble/hashes/utils.js'

import {
  CANONICAL_SERIALIZER_VERSION,
  canonicalSerialize,
} from './canonical-json.js'

const encoder = new TextEncoder()

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
