/** Layout-scoped browser executor with Web Locks leadership and query hints. */

import type { BrowserExecutorFailure } from './browser-runtime-errors'
import { BROWSER_EXECUTION_ENABLED } from '@talelabs/flows'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { toast } from 'sonner'
import { BROWSER_CREDENTIALS_CHANGED_EVENT } from '../../../settings/execution-runtime-preference'
import { useSettingsTabState } from '../../../settings/settings-state'
import { flowQueryKeys } from '../../data/query-keys/flow-query-keys'
import { BrowserRunCoordinator } from './browser-run-coordinator'
import {
  BROWSER_RUN_HINT_EVENT,
  browserRunChannelName,
  parseBrowserRunHint,
  rememberActiveBrowserRun,
} from './browser-run-hints'
import { touchBrowserRunJournal } from './browser-run-journal'
import {
  listActiveBrowserRuns,
  updateBrowserExecutorStatus,
} from './browser-runtime-api'

function browserExecutorId() {
  const key = 'talelabs.browserExecutorId.v1'
  const existing = sessionStorage.getItem(key)
  if (existing)
    return existing
  const value = crypto.randomUUID()
  sessionStorage.setItem(key, value)
  return value
}

/** Mounts one browser driver for the authenticated user and organization. */
export function BrowserRunRoot({
  organizationId,
  userId,
}: {
  organizationId: string
  userId: string
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [, setSettingsTab] = useSettingsTabState()
  const [credentialRevision, setCredentialRevision] = useState(0)
  const reportFailure = useCallback(
    (failure: BrowserExecutorFailure) => {
      const needsCredential
        = failure.code === 'credential_required'
          || failure.code === 'credential_store_unavailable'
      const message = needsCredential
        ? t(
            `flows.browserExecution.${failure.code}` as 'flows.browserExecution.credential_required',
          )
        : failure.status === 'retrying'
          ? t('flows.browserExecution.retrying')
          : t('flows.browserExecution.failed')
      toast.error(message, {
        id: `browser-executor-${failure.code}`,
        ...(needsCredential
          ? {
              action: {
                label: t('flows.browserExecution.openSecureStore'),
                onClick: () => void setSettingsTab('secureStore'),
              },
            }
          : {}),
      })
    },
    [setSettingsTab, t],
  )

  const persistGlobalFailure = useCallback(
    async (failure: BrowserExecutorFailure) => {
      reportFailure(failure)
      const runIds = await listActiveBrowserRuns(organizationId)
      await Promise.allSettled(
        runIds.map(runId =>
          updateBrowserExecutorStatus(organizationId, runId, failure),
        ),
      )
    },
    [organizationId, reportFailure],
  )

  useEffect(() => {
    const restartExecutor = () =>
      setCredentialRevision(revision => revision + 1)
    window.addEventListener(BROWSER_CREDENTIALS_CHANGED_EVENT, restartExecutor)
    return () =>
      window.removeEventListener(
        BROWSER_CREDENTIALS_CHANGED_EVENT,
        restartExecutor,
      )
  }, [])

  useEffect(() => {
    if (!BROWSER_EXECUTION_ENABLED)
      return
    const abortController = new AbortController()
    if (!navigator.locks) {
      void persistGlobalFailure({
        code: 'browser_locks_unavailable',
        status: 'error',
      }).catch(() => undefined)
      return () => abortController.abort()
    }
    let channel: BroadcastChannel
    try {
      channel = new BroadcastChannel(browserRunChannelName(organizationId, userId))
    }
    catch {
      void persistGlobalFailure({
        code: 'browser_api_unavailable',
        status: 'retrying',
      }).catch(() => undefined)
      return () => abortController.abort()
    }
    const executorId = browserExecutorId()
    const coordinator = new BrowserRunCoordinator({
      channel,
      executorId,
      organizationId,
      onFailure: reportFailure,
      queryClient,
      signal: abortController.signal,
      userId,
    })
    const reconcileHint = (value: unknown) => {
      const hint = parseBrowserRunHint(value)
      if (hint) {
        rememberActiveBrowserRun(queryClient, organizationId, userId, hint.runId)
        void queryClient.invalidateQueries({
          queryKey: flowQueryKeys.run(organizationId, hint.runId),
        })
        coordinator.wake()
      }
    }
    const handleMessage = (event: MessageEvent) => reconcileHint(event.data)
    const handleLocalHint = (event: Event) => {
      reconcileHint((event as CustomEvent<unknown>).detail)
    }
    channel.addEventListener('message', handleMessage)
    window.addEventListener(BROWSER_RUN_HINT_EVENT, handleLocalHint)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        void touchBrowserRunJournal(organizationId, userId).catch(() => {
          reportFailure({ code: 'browser_executor_failed', status: 'error' })
        })
      }
      else if (coordinator.hasActiveWork()) {
        coordinator.wake()
      }
    }
    const handleOnline = () => {
      if (coordinator.hasActiveWork())
        coordinator.wake()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('online', handleOnline)
    void navigator.locks
      .request(
        `talelabs-browser-run:${organizationId}:${userId}`,
        { mode: 'exclusive', signal: abortController.signal },
        () => coordinator.run(),
      )
      .catch(() => {
        if (!abortController.signal.aborted) {
          void persistGlobalFailure({
            code: 'browser_locks_unavailable',
            status: 'error',
          }).catch(() => undefined)
        }
      })
    return () => {
      abortController.abort()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener(BROWSER_RUN_HINT_EVENT, handleLocalHint)
      channel.removeEventListener('message', handleMessage)
      channel.close()
    }
  }, [
    credentialRevision,
    organizationId,
    persistGlobalFailure,
    queryClient,
    reportFailure,
    userId,
  ])

  return null
}
