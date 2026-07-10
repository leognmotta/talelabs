import { adminClient, organizationClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'
import { getResolvedLocale } from '../../i18n/i18n'

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:5174',
  fetchOptions: {
    onRequest(context) {
      context.headers.set('Accept-Language', getResolvedLocale())
    },
  },
  plugins: [
    adminClient(),
    organizationClient(),
  ],
})

export const {
  signIn,
  signOut,
  signUp,
  useSession,
} = authClient
