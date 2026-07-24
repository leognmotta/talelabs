/** Organization-scoped TanStack Query keys for Project server state. */

import { organizationQueryKeys } from '../organizations/organization-query-keys'

function projectScope(organizationId: null | string) {
  return [...organizationQueryKeys.scope(organizationId), 'projects'] as const
}

/** Canonical Project list, detail, home, Brief, and mention query keys. */
export const projectQueryKeys = {
  /** Every Project query for one organization. */
  scope: projectScope,
  /** Every Project list query for one organization. */
  lists: (organizationId: null | string) => [
    ...projectScope(organizationId),
    'list',
  ] as const,
  /** One filtered cursor-paginated Project list. */
  list: (
    organizationId: null | string,
    filters: Record<string, unknown>,
  ) => [
    ...projectScope(organizationId),
    'list',
    filters,
  ] as const,
  /** One Project identity and grouped counts. */
  detail: (organizationId: null | string, projectId: null | string) => [
    ...projectScope(organizationId),
    'detail',
    projectId,
  ] as const,
  /** Compact bounded Project Home payload. */
  home: (organizationId: null | string, projectId: null | string) => [
    ...projectScope(organizationId),
    'home',
    projectId,
  ] as const,
  /** Authoritative Project Brief document. */
  brief: (organizationId: null | string, projectId: null | string) => [
    ...projectScope(organizationId),
    'brief',
    projectId,
  ] as const,
  /** One grouped Project-scoped mention search. */
  mentions: (
    organizationId: null | string,
    projectId: null | string,
    search: string,
  ) => [
    ...projectScope(organizationId),
    'brief-mentions',
    projectId,
    search,
  ] as const,
}
