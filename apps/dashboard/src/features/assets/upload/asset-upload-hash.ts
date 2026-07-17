/** Abort-aware chunked MD5 calculation required by the storage upload grant. */

import SparkMD5 from 'spark-md5'

const HASH_CHUNK_SIZE = 4 * 1024 * 1024

/** Hashes a file incrementally and reports hashing-stage progress from zero to one. */
export async function calculateAssetUploadMd5(
  file: File,
  signal: AbortSignal,
  onProgress: (progress: number) => void,
) {
  const hash = new SparkMD5.ArrayBuffer()
  let offset = 0

  while (offset < file.size) {
    if (signal.aborted)
      throw new DOMException('Upload canceled', 'AbortError')
    const chunk = await file
      .slice(offset, offset + HASH_CHUNK_SIZE)
      .arrayBuffer()
    hash.append(chunk)
    offset += chunk.byteLength
    onProgress(Math.min(offset / file.size, 1))
  }

  const binary = hash.end(true)
  return btoa(binary)
}
