/** Storage, tenant-isolation, webhook-inbox, and billing-read certification. */

import type { Kysely } from 'kysely'
import type { Database } from '../src/schema.js'

import { sql } from 'kysely'

import {
  expectRejected,
  invariant,
} from './billing-verifier-support.js'

/** Verifies persisted content is reflected by billing and usage projections. */
export async function verifyBillingContentProjections(input: {
  accounting: typeof import('../src/index.js')
  catalogRevision: string
  database: Kysely<Database>
  generationJobId: string
}) {
  const billingRead
    = await import('../../../apps/api/src/domain/billing/read.service.js')
  await sql`
    insert into "assets" (
      "id", "organizationId", "name", "type", "source", "storageKey",
      "mimeType", "generationJobId", "outputIndex", "processingState"
    )
    values (
      'billing-generated-asset',
      'billing-org-b',
      'Generated',
      'image',
      'generation',
      'billing-verifier/generated',
      'image/png',
      ${input.generationJobId},
      0,
      'ready'
    )
  `.execute(input.database)
  await input.accounting.commitGeneratedAssetStorage({
    assetId: 'billing-generated-asset',
    organizationId: 'billing-org-b',
    outputCount: 1,
    sizeBytes: 4,
    storageLimitBytes: 100,
  }, input.database)
  await input.accounting.claimUploadedAssetStorage({
    catalogRevision: input.catalogRevision,
    organizationId: 'billing-org-b',
    sizeBytes: 10,
    storageLimitBytes: 14,
  }, input.database)
  await sql`
    insert into "assets" (
      "id", "organizationId", "name", "type", "source", "storageKey",
      "mimeType", "sizeBytes", "uploadId", "processingState"
    )
    values (
      'billing-upload-asset',
      'billing-org-b',
      'Upload',
      'image',
      'upload',
      'billing-verifier/upload',
      'image/png',
      10,
      'billing-verifier-upload',
      'ready'
    )
  `.execute(input.database)
  await expectRejected(() => input.accounting.claimUploadedAssetStorage({
    catalogRevision: input.catalogRevision,
    organizationId: 'billing-org-b',
    sizeBytes: 1,
    storageLimitBytes: 14,
  }, input.database), 'storage_quota')

  await sql`
    insert into "projects" ("id", "organizationId", "name")
    values ('billing-project', 'billing-org-b', 'Billing project')
  `.execute(input.database)
  await sql`
    update "assets"
    set "projectId" = 'billing-project'
    where "organizationId" = 'billing-org-b'
  `.execute(input.database)
  await sql`
    insert into "elements" ("id", "organizationId", "kind", "name")
    values
      ('billing-element', 'billing-org-b', 'style', 'Billing element'),
      ('billing-other-element', 'billing-org-a', 'style', 'Other element')
  `.execute(input.database)
  await sql`
    insert into "elementReferences" (
      "organizationId", "elementId", "assetId", "sortOrder"
    )
    values (
      'billing-org-b',
      'billing-element',
      'billing-generated-asset',
      0
    )
  `.execute(input.database)
  await expectRejected(() => sql`
    insert into "elementReferences" (
      "organizationId", "elementId", "assetId", "sortOrder"
    )
    values (
      'billing-org-a',
      'billing-other-element',
      'billing-generated-asset',
      0
    )
  `.execute(input.database), 'tenant_isolation')
  invariant(
    (await input.accounting.reconcileOrganizationStorageUsage(
      'billing-org-b',
      input.database,
    )).matches,
    'storage_projection_reconciliation',
  )

  await sql`
    insert into "stripeWebhookEvents" ("stripeEventId", "eventType")
    values ('evt_billing_verifier', 'checkout.session.completed')
    on conflict ("stripeEventId") do nothing
  `.execute(input.database)
  await sql`
    insert into "stripeWebhookEvents" ("stripeEventId", "eventType")
    values ('evt_billing_verifier', 'checkout.session.completed')
    on conflict ("stripeEventId") do nothing
  `.execute(input.database)
  const webhookCount = await sql<{ count: number }>`
    select count(*)::integer as "count"
    from "stripeWebhookEvents"
    where "stripeEventId" = 'evt_billing_verifier'
  `.execute(input.database)
  invariant(
    webhookCount.rows[0]?.count === 1,
    'webhook_inbox_idempotency',
  )

  const account = await billingRead.getBillingAccountSummary({
    canManageBilling: true,
    organizationId: 'billing-org-b',
  }, input.database)
  const usage = await billingRead.getBillingUsageSummary({
    organizationId: 'billing-org-b',
  }, input.database)
  invariant(account.plan.founder, 'founder_account_projection')
  invariant(account.storage.usedBytes === 14, 'account_storage_projection')
  invariant(usage.content.projects.count === 1, 'usage_project_count')
  invariant(
    usage.content.projects.assetCount === 2,
    'usage_project_asset_count',
  )
  invariant(usage.content.assets.count === 2, 'usage_asset_count')
  invariant(usage.content.elements.count === 1, 'usage_element_count')
  invariant(
    usage.content.elements.referenceCount === 1,
    'usage_reference_count',
  )
  invariant(
    usage.content.assets.byMediaType.reduce(
      (total, media) => total + media.usedBytes,
      0,
    ) === account.storage.usedBytes,
    'usage_account_storage_consistency',
  )
}
