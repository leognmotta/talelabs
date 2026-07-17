/** Tag mutations and targeted tag-list cache reconciliation. */

import type { TagListResponse } from '@talelabs/sdk'

import { postTags } from '@talelabs/sdk'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getOrganizationRequestHeaders } from '../../../shared/lib/organization-request'
import { assetQueryKeys } from './asset-query-keys'
import { hasOrganizationScopeCache } from './organization-scope-cache'

/** Creates tag mutations while retaining the existing optimistic list update. */
export function useTagMutations() {
  const queryClient = useQueryClient()

  return {
    create: useMutation({
      mutationFn: ({ name, organizationId }: {
        name: string
        organizationId: string
      }) => postTags(
        { data: { name } },
        { headers: getOrganizationRequestHeaders(organizationId) },
      ),
      onSuccess: (tag, { organizationId }) => {
        if (!hasOrganizationScopeCache(queryClient, organizationId))
          return
        queryClient.setQueryData<TagListResponse>(
          assetQueryKeys.tags(organizationId),
          current =>
            current
              ? {
                  data: current.data.some(item => item.id === tag.id)
                    ? current.data.map(item =>
                        item.id === tag.id ? tag : item,
                      )
                    : [...current.data, tag],
                }
              : { data: [tag] },
        )
      },
      onSettled: (_data, error, { organizationId }) => {
        void queryClient.invalidateQueries({
          queryKey: assetQueryKeys.tags(organizationId),
          refetchType: error ? 'active' : 'none',
        })
      },
    }),
  }
}
