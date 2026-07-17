/** Abort-aware browser PUT request used to send a file to granted storage. */

import { AssetUploadError } from './asset-upload-error'

/** Uploads a file with checksum preconditions and maps transport failures to stable codes. */
export function putAssetUploadFile(input: {
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
