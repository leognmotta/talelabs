/** Database boundary for durable quota-backed Asset upload grants. */

import type {
  AssetUploadIntentFacts,
  Database,
} from '@talelabs/db'
import type { Kysely } from 'kysely'

import { BILLING_CATALOG } from '@talelabs/billing'
import {
  cancelUnexposedAssetUploadIntent,
  db,
  reserveAssetUploadIntent,
} from '@talelabs/db'

/** Reserves one direct-upload grant against the effective plan storage limit. */
export function reserveUploadGrantIntent(
  input: AssetUploadIntentFacts,
  database: Kysely<Database> = db,
) {
  return reserveAssetUploadIntent({
    ...input,
    catalogRevision: BILLING_CATALOG.revision,
  }, database)
}

/** Releases a grant whose signed object capability was never returned. */
export function cancelUnexposedUploadGrantIntent(
  input: {
    /** Durable upload-grant identity. */
    id: string
    /** Tenant owning the reservation. */
    organizationId: string
  },
  database: Kysely<Database> = db,
) {
  return cancelUnexposedAssetUploadIntent(input, database)
}
