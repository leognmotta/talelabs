/** Autosave-aware admission of one immutable Flow run command. */

import type {
  FlowRunExecutionMode,
  FlowRunExecutionRuntime,
} from '@talelabs/flows'
import type { FlowRun } from '@talelabs/sdk'

import { listCredentialStatuses } from '@talelabs/providers/browser'
import apiClient from '@talelabs/sdk/client'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

import { getOrganizationRequestHeaders } from '../../../../shared/lib/organization-request'
import { publishBrowserRunHint, rememberActiveBrowserRun } from '../browser-runtime/browser-run-hints'

/** Client graph-selection command admitted as an immutable Flow run. */
export interface FlowRunCommandRequest {
  mode: 'all' | 'downstream' | 'node' | 'selection' | 'upstream'
  selectedNodeIds?: string[]
  targetNodeId?: string
}

/** Saves current graph edits before admitting and observing a Flow run. */
export function useFlowRunAdmission(input: {
  executionMode: FlowRunExecutionMode
  executionRuntime: FlowRunExecutionRuntime
  flowId: string
  fundingSource: 'byok' | 'credits'
  observeRun: (run: FlowRun) => void
  organizationId: string
  saveNow: (options?: {
    reconcileWithServer?: boolean
  }) => Promise<null | number>
  userId: string | undefined
}) {
  const queryClient = useQueryClient()
  const {
    executionMode,
    executionRuntime,
    flowId,
    fundingSource,
    observeRun,
    organizationId,
    saveNow,
    userId,
  } = input
  return useCallback(
    async (command: FlowRunCommandRequest) => {
      let byokProviders: ('fal' | 'openrouter')[] | undefined
      if (executionMode === 'live' && executionRuntime === 'browser') {
        if (!userId)
          return { reason: 'credential_store_unavailable' as const }
        let credentials
        try {
          credentials = await listCredentialStatuses({ userId })
        }
        catch {
          return { reason: 'credential_store_unavailable' as const }
        }
        if (credentials.length === 0)
          return { reason: 'credential_required' as const }
        byokProviders = credentials.map(status => status.providerId)
      }
      const revision = await saveNow()
      if (revision === null)
        return { reason: 'save_failed' as const }
      const response = await apiClient<FlowRun>({
        data: {
          executionMode,
          executionRuntime,
          expectedFlowRevision: revision,
          fundingSource,
          mode: command.mode,
          ...(byokProviders ? { byokProviders } : {}),
          ...(command.mode === 'selection'
            ? { selectedNodeIds: command.selectedNodeIds }
            : command.mode === 'all'
              ? {}
              : { targetNodeId: command.targetNodeId }),
        },
        headers: {
          ...getOrganizationRequestHeaders(organizationId),
          'Idempotency-Key': globalThis.crypto.randomUUID(),
        },
        method: 'POST',
        url: `/flows/${flowId}/runs`,
      })
      observeRun(response.data)
      if (response.data.executionRuntime === 'browser' && userId) {
        rememberActiveBrowserRun(
          queryClient,
          organizationId,
          userId,
          response.data.id,
        )
        publishBrowserRunHint(organizationId, userId, response.data.id)
      }
      return { run: response.data }
    },
    [
      executionMode,
      executionRuntime,
      flowId,
      fundingSource,
      observeRun,
      organizationId,
      queryClient,
      saveNow,
      userId,
    ],
  )
}
