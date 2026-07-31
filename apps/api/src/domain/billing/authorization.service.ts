/** Organization billing authorization derived only from authenticated context. */

import {
  getOrganizationMemberRole,
  isOrganizationAdminRole,
} from '@talelabs/auth'

import { HttpError } from '../../middleware/error.js'

/** Requires platform operator authority for program-level billing mutations. */
export function requireSystemBillingAdministrator(input: {
  /** Authenticated system-administrator context. */
  isSystemAdmin: boolean
}) {
  if (!input.isSystemAdmin) {
    throw new HttpError(
      403,
      'system_admin_required',
      'System administrator access is required.',
    )
  }
}

/** Resolves whether the authenticated user may manage organization billing. */
export async function canManageOrganizationBilling(input: {
  /** Authenticated system-administrator context. */
  isSystemAdmin: boolean
  /** Active authenticated tenant. */
  organizationId: string
  /** Authenticated user identity. */
  userId: string
}) {
  if (input.isSystemAdmin)
    return true
  const role = await getOrganizationMemberRole(
    input.userId,
    input.organizationId,
  )
  return isOrganizationAdminRole(role)
}

/** Requires owner/admin authority before a financial read or mutation. */
export async function requireOrganizationBillingAdministrator(input: {
  /** Authenticated system-administrator context. */
  isSystemAdmin: boolean
  /** Active authenticated tenant. */
  organizationId: string
  /** Authenticated user identity. */
  userId: string
}) {
  if (!await canManageOrganizationBilling(input)) {
    throw new HttpError(
      403,
      'billing_admin_required',
      'Organization billing administrator access is required.',
    )
  }
}
