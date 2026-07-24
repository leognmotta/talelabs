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

import { getOrganizationRequestHeaders } from '../../../shared/lib/organization-request'
import {
  publishBrowserRunHint,
  rememberActiveBrowserRun,
} from '../../flows/runs/browser-runtime/browser-run-hints'

/** Client graph-selection command admitted as an immutable Flow run. */
export interface GenerationRunCommandRequest {
  mode: 'all' | 'downstream' | 'node' | 'selection' | 'upstream'
  selectedNodeIds?: string[]
  targetNodeId?: string
}

/** Confirmed ordinary Flow revision ready for immutable run admission. */
export interface SavedGenerationRunTarget {
  /** Ordinary Flow identity owning the request graph and durable run. */
  flowId: string
  /** Confirmed graph revision captured by admission. */
  revision: number
}

/** Saves current graph edits before admitting and observing a Flow run. */
export function useGenerationRunAdmission(input: {
  /** Saves or lazily creates the ordinary Flow before admission. */
  ensureSaved: () => Promise<null | SavedGenerationRunTarget>
  executionMode: FlowRunExecutionMode
  executionRuntime: FlowRunExecutionRuntime
  fundingSource: 'byok' | 'credits'
  observeRun: (run: FlowRun) => void
  organizationId: string
  userId: string | undefined
}) {
  const queryClient = useQueryClient()
  const {
    ensureSaved,
    executionMode,
    executionRuntime,
    fundingSource,
    observeRun,
    organizationId,
    userId,
  } = input
  return useCallback(
    async (command: GenerationRunCommandRequest) => {
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
      const saved = await ensureSaved()
      if (saved === null)
        return { reason: 'save_failed' as const }
      const response = await apiClient<FlowRun>({
        data: {
          executionMode,
          executionRuntime,
          expectedFlowRevision: saved.revision,
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
        url: `/flows/${saved.flowId}/runs`,
      })
      observeRun(response.data)
      if (response.data.executionRuntime === 'browser' && userId) {
        rememberActiveBrowserRun(
          queryClient,
          organizationId,
          userId,
          response.data.id,
        )
        publishBrowserRunHint(
          response.data.flowId,
          organizationId,
          response.data.source,
          userId,
          response.data.id,
        )
      }
      return { run: response.data }
    },
    [
      ensureSaved,
      executionMode,
      executionRuntime,
      fundingSource,
      observeRun,
      organizationId,
      queryClient,
      userId,
    ],
  )
}
