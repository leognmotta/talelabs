/** Browser Secure Store status projection for Create execution guidance. */

import type { BrowserCredentialProviderId } from '@talelabs/providers/browser'

import { listCredentialStatuses } from '@talelabs/providers/browser'
import { useEffect, useState } from 'react'
import { BROWSER_CREDENTIALS_CHANGED_EVENT } from '../settings/execution-runtime-preference'

/** Non-secret browser credential status used without copying keys into state. */
export interface CreateCredentialStatus {
  /** Connected provider identifiers; no credential material is retained. */
  providers: ReadonlySet<BrowserCredentialProviderId>
  /** Secure Store read lifecycle. */
  status: 'loading' | 'ready' | 'unavailable'
}

/** Refreshes provider-presence facts when the existing Secure Store changes. */
export function useCreateCredentialStatus(
  userId: string | undefined,
): CreateCredentialStatus {
  const [state, setState] = useState<CreateCredentialStatus>(() => ({
    providers: new Set(),
    status: 'loading',
  }))

  useEffect(() => {
    let active = true
    async function refresh() {
      if (!userId) {
        if (active)
          setState({ providers: new Set(), status: 'unavailable' })
        return
      }
      try {
        const statuses = await listCredentialStatuses({ userId })
        if (active) {
          setState({
            providers: new Set(statuses.map(status => status.providerId)),
            status: 'ready',
          })
        }
      }
      catch {
        if (active)
          setState({ providers: new Set(), status: 'unavailable' })
      }
    }
    void refresh()
    window.addEventListener(BROWSER_CREDENTIALS_CHANGED_EVENT, refresh)
    return () => {
      active = false
      window.removeEventListener(BROWSER_CREDENTIALS_CHANGED_EVENT, refresh)
    }
  }, [userId])

  return state
}
