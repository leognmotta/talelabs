/** Run-level debug execution authorization and snapshot projection. */

import type { FlowRunExecutionMode } from '@talelabs/flows'

import { readFlowRunExecutionMode } from '@talelabs/flows'
import { HttpError } from '../../middleware/error.js'

/** Rejects attempts to cross the system-admin-only debug boundary. */
export function assertFlowRunExecutionModeAuthorized(
  executionMode: FlowRunExecutionMode,
  isSystemAdmin: boolean,
) {
  if (executionMode === 'debug' && !isSystemAdmin) {
    throw new HttpError(
      403,
      'debug_mode_forbidden',
      'Debug mode requires system administrator access.',
    )
  }
}

/** Reads a run execution mode from the immutable snapshot envelope. */
export function executionModeFromSnapshot(snapshot: unknown) {
  const value = snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)
    ? (snapshot as Record<string, unknown>).executionMode
    : undefined
  return readFlowRunExecutionMode(value)
}
