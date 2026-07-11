import type { ReactNode } from 'react'

import { setApiRequestOrganizationId } from '@talelabs/sdk'
import { useLayoutEffect } from 'react'
import { OrganizationScopeContext } from './organization-scope-context'

export function OrganizationScopeProvider({
  children,
  organizationId,
}: {
  children: ReactNode
  organizationId: null | string
}) {
  useLayoutEffect(() => {
    setApiRequestOrganizationId(organizationId)

    return () => setApiRequestOrganizationId(null)
  }, [organizationId])

  return (
    <OrganizationScopeContext value={organizationId}>
      {children}
    </OrganizationScopeContext>
  )
}
