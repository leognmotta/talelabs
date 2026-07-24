/**
 * Session mutations and cache reconciliation for the Create workspace.
 *
 * Drafts remain browser-local. These mutations change only the lightweight
 * session identity used to group direct runs.
 */

import type { RenameCreateSessionRequest } from '@talelabs/sdk'
import {
  deleteCreateSessionsId,
  patchCreateSessionsId,
} from '@talelabs/sdk'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { getOrganizationRequestHeaders } from '../../../shared/lib/organization-request'
import { projectQueryKeys } from '../../projects/project-query-keys'
import { createSessionQueryKeys } from './create-session-query-keys'

/** Updates one session identity/location and refreshes every scoped projection. */
export function useUpdateCreateSessionMutation(organizationId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      data: RenameCreateSessionRequest
      id: string
    }) =>
      patchCreateSessionsId(
        { data: input.data, id: input.id },
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
      void queryClient.invalidateQueries({
        queryKey: projectQueryKeys.scope(organizationId),
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
      void queryClient.invalidateQueries({
        queryKey: projectQueryKeys.scope(organizationId),
      })
    },
  })
}
