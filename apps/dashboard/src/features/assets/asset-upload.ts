import type { Asset } from '@talelabs/sdk'

import { getAssetUploadValidationError } from '@talelabs/assets'
import { postAssets, postUploads } from '@talelabs/sdk'
import SparkMD5 from 'spark-md5'

const HASH_CHUNK_SIZE = 4 * 1024 * 1024

export type AssetUploadErrorCode
  = | 'file_too_large'
    | 'storage_request_blocked'
    | 'storage_upload_rejected'
    | 'unsupported_file_type'

export class AssetUploadError extends Error {
  readonly code: AssetUploadErrorCode

  constructor(message: string, code: AssetUploadErrorCode) {
    super(message)
    this.name = 'AssetUploadError'
    this.code = code
  }
}

function throwIfAborted(signal: AbortSignal) {
  if (signal.aborted)
    throw new DOMException('Upload canceled', 'AbortError')
}

async function calculateMd5(
  file: File,
  signal: AbortSignal,
  onProgress: (progress: number) => void,
) {
  const hash = new SparkMD5.ArrayBuffer()
  let offset = 0

  while (offset < file.size) {
    throwIfAborted(signal)
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

function putFile(input: {
  checksum: string
  file: File
  onProgress: (progress: number) => void
  signal: AbortSignal
  url: string
}) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest()
    const abort = () => request.abort()

    request.open('PUT', input.url)
    request.setRequestHeader('Content-MD5', input.checksum)
    request.setRequestHeader('Content-Type', input.file.type)
    request.setRequestHeader('If-None-Match', '*')

    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable)
        input.onProgress(event.loaded / event.total)
    })
    request.addEventListener('load', () => {
      input.signal.removeEventListener('abort', abort)
      if (request.status >= 200 && request.status < 300) {
        resolve()
      }
      else {
        reject(
          new AssetUploadError(
            `Storage upload failed with status ${request.status}.`,
            'storage_upload_rejected',
          ),
        )
      }
    })
    request.addEventListener('error', () => {
      input.signal.removeEventListener('abort', abort)
      reject(
        new AssetUploadError(
          'The storage upload request was blocked before a response was received.',
          'storage_request_blocked',
        ),
      )
    })
    request.addEventListener('abort', () => {
      input.signal.removeEventListener('abort', abort)
      reject(new DOMException('Upload canceled', 'AbortError'))
    })
    input.signal.addEventListener('abort', abort, { once: true })
    request.send(input.file)
  })
}

export async function uploadAsset(input: {
  file: File
  folderId: null | string
  onProgress: (progress: number) => void
  signal: AbortSignal
}): Promise<Asset> {
  const validationError = getAssetUploadValidationError({
    mimeType: input.file.type,
    sizeBytes: input.file.size,
  })
  if (validationError) {
    throw new AssetUploadError(
      'The selected asset does not satisfy the upload policy.',
      validationError,
    )
  }

  const checksum = await calculateMd5(input.file, input.signal, progress =>
    input.onProgress(progress * 0.2))
  throwIfAborted(input.signal)

  const grant = await postUploads(
    {
      data: {
        checksum: { algorithm: 'md5', value: checksum },
        filename: input.file.name,
        mimeType: input.file.type,
        sizeBytes: input.file.size,
      },
    },
    { signal: input.signal },
  )

  await putFile({
    checksum,
    file: input.file,
    signal: input.signal,
    url: grant.uploadUrl,
    onProgress: progress => input.onProgress(0.2 + progress * 0.7),
  })
  throwIfAborted(input.signal)

  const asset = await postAssets(
    {
      data: {
        uploadId: grant.uploadId,
        folderId: input.folderId ?? undefined,
      },
    },
    { signal: input.signal },
  )
  input.onProgress(1)
  return asset
}
