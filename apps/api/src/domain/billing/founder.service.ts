/** Explicit, organization-authorized Founder enrollment composition. */

import type { DatabaseExecutor } from '@talelabs/db'

import {
  assignFounderStatus,
  db,
} from '@talelabs/db'

import { HttpError } from '../../middleware/error.js'

/** Assigns the one-time Founder status and welcome grant to a Free account. */
export async function enrollOrganizationFounder(input: {
  /** Administrator performing the explicit enrollment. */
  assignedBy: string
  /** Tenant receiving the immutable Founder eligibility record. */
  organizationId: string
}, database: DatabaseExecutor = db) {
  try {
    return await assignFounderStatus(input, database)
  }
  catch (error) {
    if (
      error instanceof Error
      && error.message === 'founder_requires_free_plan'
    ) {
      throw new HttpError(
        409,
        'founder_assignment_not_available',
        'Founder status can only be assigned while the organization is Free.',
      )
    }
    throw error
  }
}
