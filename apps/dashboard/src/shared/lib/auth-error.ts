import { i18n } from '../../i18n/i18n'

const authErrorKeys: Readonly<Record<string, string>> = {
  EMAIL_NOT_VERIFIED: 'auth.emailNotVerified',
  INVALID_EMAIL_OR_PASSWORD: 'auth.invalidCredentials',
  SESSION_EXPIRED: 'auth.sessionExpired',
  USER_ALREADY_EXISTS: 'auth.userAlreadyExists',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'auth.userAlreadyExists',
}

export function getAuthErrorMessage(
  error: { code?: string | undefined, message?: string | undefined } | null,
  fallbackKey: string,
) {
  const errorKey = error?.code ? authErrorKeys[error.code] : null
  const fallback = i18n.t(fallbackKey as 'auth.authenticationFailed')

  if (!errorKey)
    return fallback

  return i18n.t(errorKey as 'auth.authenticationFailed', {
    defaultValue: error?.message ?? fallback,
  })
}
