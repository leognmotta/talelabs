/** Autosave-aware admission of one immutable Flow run command. */

import type { FlowRunExecutionMode } from '@talelabs/flows'
import type { FlowRun } from '@talelabs/sdk'

import apiClient from '@talelabs/sdk/client'
import { useCallback } from 'react'

import { getOrganizationRequestHeaders } from '../../../../shared/lib/organization-request'

/** Client graph-selection command admitted as an immutable Flow run. */
export interface FlowRunCommandRequest {
  mode: 'all' | 'downstream' | 'node' | 'selection' | 'upstream'
  selectedNodeIds?: string[]
  targetNodeId?: string
}

/** Saves current graph edits before admitting and observing a Flow run. */
export function useFlowRunAdmission(input: {
  executionMode: FlowRunExecutionMode
  flowId: string
  observeRun: (run: FlowRun) => void
  organizationId: string
  saveNow: (options?: { reconcileWithServer?: boolean }) => Promise<null | number>
}) {
  const { executionMode, flowId, observeRun, organizationId, saveNow } = input
  return useCallback(async (command: FlowRunCommandRequest) => {
    const revision = await saveNow()
    if (revision === null)
      return { reason: 'save_failed' as const }
    const response = await apiClient<FlowRun>({
      data: {
        executionMode,
        expectedFlowRevision: revision,
        mode: command.mode,
        ...(command.mode === 'selection'
          ? { selectedNodeIds: command.selectedNodeIds }
          : command.mode === 'all' ? {} : { targetNodeId: command.targetNodeId }),
      },
      headers: {
        ...getOrganizationRequestHeaders(organizationId),
        'Idempotency-Key': globalThis.crypto.randomUUID(),
      },
      method: 'POST',
      url: `/flows/${flowId}/runs`,
    })
    observeRun(response.data)
    return { run: response.data }
  }, [executionMode, flowId, observeRun, organizationId, saveNow])
}
