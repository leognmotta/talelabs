export const GENERATION_PROVIDER_MAX_POLL_DURATION_MS
  = 8 * 60 * 60 * 1_000

/**
 * Provider references are signed immediately before submission. Keep them
 * readable for the full accepted async execution window plus fetch/clock grace.
 */
export const GENERATION_PROVIDER_INPUT_URL_EXPIRES_IN_SECONDS
  = (GENERATION_PROVIDER_MAX_POLL_DURATION_MS + 60 * 60 * 1_000) / 1_000
