/**
 * Session mutations and cache reconciliation for the Create workspace.
 *
 * Drafts remain browser-local. These mutations change only the lightweight
 * session identity used to group direct runs.
 */

import {
  deleteCreateSessionsId,
  patchCreateSessionsId,
} from '@talelabs/sdk'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { getOrganizationRequestHeaders } from '../../../shared/lib/organization-request'
import { createSessionQueryKeys } from './create-session-query-keys'

/** Renames one owned Create session and refreshes its list/detail projections. */
export function useRenameCreateSessionMutation(organizationId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { id: string, name: string }) =>
      patchCreateSessionsId(
        { data: { name: input.name }, id: input.id },
        { headers: getOrganizationRequestHeaders(organizationId) },
      ),
    onSuccess: (session) => {
      queryClient.setQueryData(
        createSessionQueryKeys.detail(organizationId, session.id),
        session,
      )
      void queryClient.invalidateQueries({
        queryKey: createSessionQueryKeys.lists(organizationId),
      })
    },
  })
}

/** Soft-deletes one owned session while retaining its runs and output Assets. */
export function useDeleteCreateSessionMutation(organizationId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteCreateSessionsId(
      { id },
      { headers: getOrganizationRequestHeaders(organizationId) },
    ),
    onSuccess: (_response, id) => {
      queryClient.removeQueries({
        exact: true,
        queryKey: createSessionQueryKeys.detail(organizationId, id),
      })
      void queryClient.invalidateQueries({
        queryKey: createSessionQueryKeys.lists(organizationId),
      })
    },
  })
}
