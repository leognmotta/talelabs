/**
 * Bounded media signature checks used by protocol responses.
 *
 */

/** Returns whether bytes begin with a supported MP3 signature. */
export function isMp3(bytes: Uint8Array) {
  if (bytes.byteLength < 3)
    return false
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33)
    return true
  return bytes.byteLength >= 2
    && bytes[0] === 0xFF
    && (bytes[1]! & 0xE0) === 0xE0
}

/** Returns whether bytes contain an MP4 `ftyp` box at the expected offset. */
export function isMp4(bytes: Uint8Array) {
  return bytes.byteLength >= 12
    && bytes[4] === 0x66
    && bytes[5] === 0x74
    && bytes[6] === 0x79
    && bytes[7] === 0x70
}

/** Returns whether bytes begin with a RIFF/WAVE container signature. */
export function isWav(bytes: Uint8Array) {
  return bytes.byteLength >= 12
    && bytes[0] === 0x52
    && bytes[1] === 0x49
    && bytes[2] === 0x46
    && bytes[3] === 0x46
    && bytes[8] === 0x57
    && bytes[9] === 0x41
    && bytes[10] === 0x56
    && bytes[11] === 0x45
}
