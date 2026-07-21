/** URL host validation for fal queue and output-media requests. */

import {
  FAL_ALLOWED_MEDIA_HOST_SUFFIXES,
  FAL_GOOGLE_MEDIA_BUCKET,
  FAL_GOOGLE_MEDIA_HOST,
  FAL_GOOGLE_MEDIA_PATH_PREFIX,
  FalHttpError,
} from './contracts.js'

function rejectUrl(): never {
  throw new FalHttpError({ code: 'rejected', retryable: false })
}

function falGoogleMediaApiUrl(url: URL): URL {
  const encodedObjectPath = url.pathname.slice(FAL_GOOGLE_MEDIA_PATH_PREFIX.length)
  if (!encodedObjectPath)
    rejectUrl()
  let objectPath: string
  try {
    objectPath = decodeURIComponent(encodedObjectPath)
  }
  catch {
    rejectUrl()
  }
  const apiUrl = new URL(
    `/download/storage/v1/b/${FAL_GOOGLE_MEDIA_BUCKET}/o/${encodeURIComponent(objectPath)}`,
    url.origin,
  )
  // The public XML object URL omits CORS headers; the equivalent JSON media
  // endpoint reflects the browser origin while retaining the same object scope.
  apiUrl.searchParams.set('alt', 'media')
  return apiUrl
}

/** Parses and confirms a queue URL targets the authorized fal queue origin. */
export function assertFalQueueUrl(value: string, allowedOrigin: string): URL {
  let url: URL
  try {
    url = new URL(value)
  }
  catch {
    rejectUrl()
  }
  if (url.origin !== new URL(allowedOrigin).origin)
    rejectUrl()
  return url
}

/** Parses and confirms an output URL targets an authorized fal media host. */
export function assertFalMediaUrl(value: string, allowedOrigin: string): URL {
  let url: URL
  try {
    url = new URL(value)
  }
  catch {
    rejectUrl()
  }
  const onQueueOrigin = url.origin === new URL(allowedOrigin).origin
  const onMediaHost = FAL_ALLOWED_MEDIA_HOST_SUFFIXES.some(
    suffix => url.hostname.endsWith(suffix),
  )
  const onFalGoogleObject = url.hostname === FAL_GOOGLE_MEDIA_HOST
    && url.pathname.startsWith(FAL_GOOGLE_MEDIA_PATH_PREFIX)
  if (url.protocol !== 'https:')
    rejectUrl()
  if (onFalGoogleObject)
    return falGoogleMediaApiUrl(url)
  if (!onMediaHost && !onQueueOrigin)
    rejectUrl()
  return url
}
