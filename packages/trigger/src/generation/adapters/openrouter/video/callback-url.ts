import process from 'node:process'

export const OPENROUTER_WEBHOOK_SECRET_ENV = 'OPENROUTER_WEBHOOK_SECRET'

/** Returns a callback target only when a public HTTPS receiver is configured. */
export function openRouterVideoCallbackUrl(input: {
  generationJobId: string
  organizationId: string
  env?: NodeJS.ProcessEnv
}) {
  const env = input.env ?? process.env
  if (!env[OPENROUTER_WEBHOOK_SECRET_ENV] || !env.BETTER_AUTH_URL)
    return undefined
  const url = new URL(
    `/provider-callbacks/openrouter/video/${encodeURIComponent(input.organizationId)}/${encodeURIComponent(input.generationJobId)}`,
    env.BETTER_AUTH_URL,
  )
  if (url.protocol !== 'https:')
    return undefined
  return url.toString()
}
