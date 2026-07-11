const MIN_EXPECTED_UPLOAD_BYTES_PER_SECOND = 128 * 1024
const UPLOAD_REGISTRATION_GRACE_SECONDS = 15 * 60

export function getUploadRegistrationGrantTtlSeconds(sizeBytes: number) {
  const transferSeconds = Math.ceil(
    sizeBytes / MIN_EXPECTED_UPLOAD_BYTES_PER_SECOND,
  )

  return UPLOAD_REGISTRATION_GRACE_SECONDS + transferSeconds
}
