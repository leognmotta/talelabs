import type { ElementType, GetElementsQueryParams } from '@talelabs/sdk'
import { organizationQueryKeys } from '../organizations/organization-query-keys'

function elementScope(organizationId: null | string) {
  return [
    ...organizationQueryKeys.scope(organizationId),
    'elements',
  ] as const
}

export const elementQueryKeys = {
  scope: elementScope,
  lists: (organizationId: null | string) => [
    ...elementScope(organizationId),
    'list',
  ] as const,
  list: (
    organizationId: null | string,
    params: GetElementsQueryParams,
  ) => [
    ...elementScope(organizationId),
    'list',
    params,
  ] as const,
  details: (organizationId: null | string) => [
    ...elementScope(organizationId),
    'detail',
  ] as const,
  detail: (organizationId: null | string, elementId: null | string) => [
    ...elementScope(organizationId),
    'detail',
    elementId,
  ] as const,
  kits: (organizationId: null | string) => [
    ...elementScope(organizationId),
    'kit',
  ] as const,
  kit: (organizationId: null | string, elementId: null | string) => [
    ...elementScope(organizationId),
    'kit',
    elementId,
  ] as const,
  usage: (organizationId: null | string, elementId: null | string) => [
    ...elementScope(organizationId),
    'usage',
    elementId,
  ] as const,
  byType: (organizationId: null | string, type: ElementType) => [
    ...elementScope(organizationId),
    'type',
    type,
  ] as const,
}
