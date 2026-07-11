import type { GetAssetsQueryParams } from '@talelabs/sdk'

import { organizationQueryKeys } from '../organizations/organization-query-keys'

function organizationScope(organizationId: null | string) {
  return [
    ...organizationQueryKeys.scope(organizationId),
    'asset-library',
  ] as const
}

function assetScope(organizationId: null | string) {
  return [
    ...organizationScope(organizationId),
    'assets',
  ] as const
}

export const assetQueryKeys = {
  scope: organizationScope,
  all: assetScope,
  detail: (organizationId: null | string, id: string | null) => [
    ...assetScope(organizationId),
    'detail',
    id,
  ] as const,
  details: (organizationId: null | string) => [
    ...assetScope(organizationId),
    'detail',
  ] as const,
  folders: (organizationId: null | string) => [
    ...organizationScope(organizationId),
    'folders',
  ] as const,
  tags: (organizationId: null | string) => [
    ...organizationScope(organizationId),
    'tags',
  ] as const,
  list: (
    organizationId: null | string,
    filters: GetAssetsQueryParams,
  ) => [
    ...assetScope(organizationId),
    'list',
    filters,
  ] as const,
  lists: (organizationId: null | string) => [
    ...assetScope(organizationId),
    'list',
  ] as const,
}
