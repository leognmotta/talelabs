/** Query-key hierarchy for durable Create session identity and lists. */

import { organizationQueryKeys } from '../../organizations/organization-query-keys'

/** Prefix matching every Create session query in one tenant. */
export function createSessionScope(organizationId: null | string) {
  return [
    ...organizationQueryKeys.scope(organizationId),
    'create-sessions',
  ] as const
}

/** Prefix matching every paginated Create session list. */
export function createSessionLists(organizationId: null | string) {
  return [...createSessionScope(organizationId), 'list'] as const
}

/** Key for one searched cursor-paginated session list. */
export function createSessionList(
  organizationId: null | string,
  search: string,
) {
  return [...createSessionLists(organizationId), { search }] as const
}

/** Key for one durable Create session. */
export function createSessionDetail(
  organizationId: null | string,
  sessionId: null | string,
) {
  return [
    ...createSessionScope(organizationId),
    'detail',
    sessionId,
  ] as const
}

/** Canonical query keys owned by the Create feature. */
export const createSessionQueryKeys = {
  detail: createSessionDetail,
  list: createSessionList,
  lists: createSessionLists,
  scope: createSessionScope,
}
