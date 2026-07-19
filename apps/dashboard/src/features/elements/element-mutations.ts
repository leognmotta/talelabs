/** Element create, update, delete, and atomic reference mutations. */

import type { CreateElementRequest, UpdateElementRequest } from '@talelabs/sdk'

import {
  deleteElementsId,
  patchElementsId,
  patchElementsIdReferences,
  postElements,
} from '@talelabs/sdk'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { getOrganizationRequestHeaders } from '../../shared/lib/organization-request'
import { useActiveOrganizationId } from '../organizations/organization-scope-context'
import { invalidateElementCache } from './element-query-cache'

/** Mutations for one organization's Elements with shared cache invalidation. */
export function useElementMutations() {
  const organizationId = useActiveOrganizationId()
  const queryClient = useQueryClient()
  const headers = getOrganizationRequestHeaders(organizationId!)
  const invalidate = () => invalidateElementCache(queryClient, organizationId!)

  return {
    create: useMutation({
      mutationFn: (data: CreateElementRequest) =>
        postElements({ data }, { headers }),
      onSuccess: invalidate,
    }),
    /**
     * Atomic append/remove against the server's current reference list; the
     * response reports exactly which Assets changed, so Undo can remove only
     * what this call added without clobbering concurrent edits.
     */
    mutateReferences: useMutation({
      mutationFn: (input: { add?: string[], id: string, remove?: string[] }) =>
        patchElementsIdReferences(
          {
            id: input.id,
            data: {
              ...(input.add?.length ? { add: input.add } : {}),
              ...(input.remove?.length ? { remove: input.remove } : {}),
            },
          },
          { headers },
        ),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => deleteElementsId({ id }, { headers }),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: (input: { data: UpdateElementRequest, id: string }) =>
        patchElementsId({ id: input.id, data: input.data }, { headers }),
      onSuccess: invalidate,
    }),
  }
}
