import type { AuthSession } from '@talelabs/auth'

export interface ApiEnv {
  Variables: {
    authSession: AuthSession | null
  }
}
