/**
 * Layout-scoped state and navigation for blocked generation funding choices.
 *
 * One provider lets Create, Flow commands, and retries open the same dialog
 * without coupling creative surfaces to Settings URL state.
 */

import type { ReactNode } from 'react'
import type {
  GenerationAccessDestination,
  GenerationAccessDialogRequest,
} from './generation-access-dialog'

import {
  useCallback,
  useMemo,
  useState,
} from 'react'
import {
  useGenerationFundingPreference,
} from '../settings/generation-funding-preference'
import { useSettingsTabState } from '../settings/settings-state'
import { GenerationAccessDialog } from './generation-access-dialog'
import { GenerationAccessDialogContext } from './generation-access-dialog-context'

/** Owns the single generation access dialog available across the dashboard. */
export function GenerationAccessDialogProvider({
  children,
  userId,
}: {
  /** Dashboard subtree whose generation actions may request funding access. */
  children: ReactNode
  /** Authenticated browser user whose funding preference will be updated. */
  userId: string | undefined
}) {
  const [, setSettingsTab] = useSettingsTabState()
  const [, setFundingPreference] = useGenerationFundingPreference(userId)
  const [request, setRequest] = useState<GenerationAccessDialogRequest | null>(
    null,
  )
  const openGenerationAccessDialog = useCallback(
    (nextRequest: GenerationAccessDialogRequest) => {
      setRequest(nextRequest)
    },
    [],
  )
  const value = useMemo(
    () => ({ openGenerationAccessDialog }),
    [openGenerationAccessDialog],
  )

  const selectDestination = useCallback(
    (destination: GenerationAccessDestination) => {
      setRequest(null)
      setFundingPreference(
        destination === 'secureStore' ? 'byok' : 'credits',
      )
      void setSettingsTab(destination)
    },
    [setFundingPreference, setSettingsTab],
  )

  return (
    <GenerationAccessDialogContext value={value}>
      {children}
      <GenerationAccessDialog
        request={request}
        onOpenChange={(open) => {
          if (!open)
            setRequest(null)
        }}
        onSelect={selectDestination}
      />
    </GenerationAccessDialogContext>
  )
}
