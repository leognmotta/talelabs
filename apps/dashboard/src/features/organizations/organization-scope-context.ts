import { createContext, use } from 'react'

export const OrganizationScopeContext = createContext<null | string>(null)

export function useActiveOrganizationId() {
  return use(OrganizationScopeContext)
}
