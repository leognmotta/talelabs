export function isMp3(bytes: Uint8Array) {
  if (bytes.byteLength < 3)
    return false
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33)
    return true
  return bytes.byteLength >= 2
    && bytes[0] === 0xFF
    && (bytes[1]! & 0xE0) === 0xE0
}

export function isMp4(bytes: Uint8Array) {
  return bytes.byteLength >= 12
    && bytes[4] === 0x66
    && bytes[5] === 0x74
    && bytes[6] === 0x79
    && bytes[7] === 0x70
}
