import process from 'node:process'

const LOCAL_FROM_ADDRESS = 'TaleLabs <onboarding@resend.dev>'

type EmailEnvironment = Partial<
  Pick<NodeJS.ProcessEnv, 'NODE_ENV' | 'RESEND_FROM_EMAIL'>
>

export function getInvitationFromAddress(
  env: EmailEnvironment = process.env,
) {
  const configuredAddress = env.RESEND_FROM_EMAIL?.trim()
  if (configuredAddress)
    return configuredAddress

  if (env.NODE_ENV === 'development')
    return LOCAL_FROM_ADDRESS

  throw new Error('RESEND_FROM_EMAIL is required to send email outside local development.')
}

export function validateEmailConfiguration(
  env: EmailEnvironment = process.env,
) {
  if (env.NODE_ENV === 'production')
    getInvitationFromAddress(env)
}
