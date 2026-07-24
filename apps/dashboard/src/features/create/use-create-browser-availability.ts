/** Canonical browser-binding readiness for the current Create operation. */

import type { BrowserCredentialProviderId } from '@talelabs/providers/browser'

import { GENERATION_CATALOG_REVISION } from '@talelabs/flows'
import { postConfigGenerationBrowserAvailability } from '@talelabs/sdk'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { getOrganizationRequestHeaders } from '../../shared/lib/organization-request'
import { flowQueryKeys } from '../flows/data/query-keys/flow-query-keys'

/** Fail-closed readiness returned without disclosing private binding details. */
export type CreateBrowserAvailability
  = | 'available'
    | 'checking'
    | 'idle'
    | 'unavailable'

/**
 * Checks browser execution with the same catalog selector used by admission.
 * Provider key material remains inside Secure Store; only connected provider
 * identifiers enter this bounded request and cache key.
 */
export function useCreateBrowserAvailability(input: {
  /** Whether live browser execution currently needs the result. */
  enabled: boolean
  /** Canonical creative model selected by the direct request. */
  modelId: string
  /** Active organization authorizing the sanitized configuration request. */
  organizationId: string
  /** Provider-neutral operation resolved from the current request inputs. */
  operationId: null | string
  /** Non-secret provider identifiers whose keys exist in Secure Store. */
  providers: ReadonlySet<BrowserCredentialProviderId>
}): CreateBrowserAvailability {
  const providers = useMemo(
    () => [...input.providers].toSorted(),
    [input.providers],
  )
  const enabled = input.enabled
    && Boolean(input.modelId)
    && Boolean(input.operationId)
    && providers.length > 0
  const query = useQuery({
    queryKey: flowQueryKeys.browserGenerationAvailability(
      input.organizationId,
      GENERATION_CATALOG_REVISION,
      input.modelId,
      input.operationId ?? '',
      providers,
    ),
    queryFn: async ({ signal }) => {
      const availability = await postConfigGenerationBrowserAvailability(
        {
          data: {
            modelId: input.modelId,
            operationId: input.operationId!,
            providers,
          },
        },
        {
          headers: getOrganizationRequestHeaders(input.organizationId),
          signal,
        },
      )
      if (availability.catalogRevision !== GENERATION_CATALOG_REVISION) {
        throw new Error(
          `Generation catalog mismatch: dashboard=${GENERATION_CATALOG_REVISION}, api=${availability.catalogRevision}`,
        )
      }
      return availability
    },
    enabled,
    staleTime: 5 * 60_000,
  })

  if (!enabled)
    return 'idle'
  if (query.isPending || query.isFetching)
    return 'checking'
  if (query.isError || query.data?.executable !== true)
    return 'unavailable'
  return 'available'
}
