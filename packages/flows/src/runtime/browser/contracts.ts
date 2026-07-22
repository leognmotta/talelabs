/** Strict non-secret contracts exchanged by the browser execution driver. */

import type { BrowserCatalogProviderBinding } from '@talelabs/models-catalog'
import type { FlowRunSnapshotExecutionContract } from '../snapshots/contracts.js'

import {
  BrowserCatalogProviderBindingSchema,
  toBrowserCatalogProviderBinding,
} from '@talelabs/models-catalog'
import { z } from 'zod'

/** Code-owned rollback switch shared by admission and browser composition. */
export const BROWSER_EXECUTION_ENABLED = true
/**
 * Maximum bytes accepted for one browser-transferred canonical media output.
 * Blob fallback can briefly retain source chunks and Blob backing storage, so
 * browser mode caps one output at 64 MiB instead of the server's 512 MiB bound.
 */
export const BROWSER_RUN_MAX_OUTPUT_BYTES = 64 * 1024 * 1024

const nonnegativeInteger = z.number().int().nonnegative()
const nullableTimestamp = z.iso.datetime().nullable()
const runStatusSchema = z.enum([
  'pending',
  'running',
  'succeeded',
  'partial',
  'failed',
  'canceled',
])
const jobStatusSchema = z.enum([
  'pending',
  'running',
  'succeeded',
  'failed',
  'canceled',
])
const mediaTypeSchema = z.enum(['image', 'video', 'audio', 'text'])
const browserSubmissionStateSchema = z.enum([
  'not_started',
  'submitting',
  'submitted',
])
const normalizedMediaAssetSchema = z
  .object({
    assetId: z.string(),
    mediaType: z.enum(['audio', 'document', 'image', 'video']),
    order: nonnegativeInteger,
  })
  .strict()
const normalizedInputItemSchema = z
  .object({
    assets: z.array(normalizedMediaAssetSchema),
    dimensions: z.record(z.string(), z.string()),
    itemKey: z.string(),
    text: z.string().nullable(),
  })
  .strict()
const normalizedOrderedInputSchema = z
  .object({
    edgeId: z.string(),
    items: z.array(normalizedInputItemSchema),
    order: nonnegativeInteger,
    sourceHandleId: z.string(),
    sourceNodeId: z.string(),
    targetSlotId: z.string(),
  })
  .strict()
const normalizedTextPartSchema = z
  .object({
    edgeId: z.string().nullable(),
    itemKey: z.string().nullable(),
    order: nonnegativeInteger,
    source: z.enum(['connected', 'inline']),
    sourceNodeId: z.string().nullable(),
    text: z.string(),
  })
  .strict()
const normalizedTextSlotSchema = z
  .object({
    inputReferences: z.array(z.object({
      assetId: z.string(),
      index: nonnegativeInteger,
      itemKey: z.string(),
      mediaType: z.enum(['audio', 'image', 'video']),
      partIndex: nonnegativeInteger,
      slotId: z.string(),
      sourceNodeId: z.string(),
    }).strict()),
    parts: z.array(normalizedTextPartSchema),
    resolvedText: z.string(),
    slotId: z.string(),
    source: z.enum(['connected', 'inline']),
  })
  .strict()

/**
 * Minimal execution facts one browser adapter needs for a claimed node. The
 * full snapshot contract (endpoint identity, route versions, evidence, cost
 * policy) stays server-side; only the narrow provider binding crosses the
 * sanitized-manifest boundary.
 */
export const browserExecutionContractSchema = z
  .object({
    modelId: z.string(),
    nodeId: z.string(),
    operationId: z.string(),
    providerBinding: BrowserCatalogProviderBindingSchema,
  })
  .strict()

/** Browser-disclosed execution facts projected from one snapshot contract. */
export interface BrowserExecutionContract {
  modelId: string
  nodeId: string
  operationId: string
  providerBinding: BrowserCatalogProviderBinding
}

/** Projects one private snapshot contract onto its browser-disclosed form. */
export function toBrowserExecutionContract(
  contract: FlowRunSnapshotExecutionContract,
): BrowserExecutionContract {
  return {
    modelId: contract.modelId,
    nodeId: contract.nodeId,
    operationId: contract.operationId,
    providerBinding: toBrowserCatalogProviderBinding(contract.providerBinding),
  }
}

/** Exact provider-neutral request returned only to the active browser lease. */
export const BrowserNormalizedGenerationRequestSchema = z
  .object({
    adapterRequestVersion: z.literal(3),
    catalogRevision: z.string().regex(/^sha256:[0-9a-f]{64}$/),
    catalogVersion: z.number().int().positive(),
    itemKey: z.string(),
    modelContractVersion: z.string(),
    nodeId: z.string(),
    operationId: z.string(),
    orderedInputs: z.array(normalizedOrderedInputSchema),
    outputCount: z.number().int().positive(),
    productModelId: z.string(),
    modelRevision: z.number().int().positive(),
    requestId: z.string(),
    requestIndex: nonnegativeInteger,
    requestPayloadHash: z.string(),
    settings: z.record(
      z.string(),
      z.union([z.boolean(), z.number(), z.string()]),
    ),
    textSlots: z.array(normalizedTextSlotSchema),
  })
  .strict()

/** Short-lived canonical Asset descriptor resolved for one claimed request. */
export const BrowserRunInputAssetSchema = z
  .object({
    assetId: z.string(),
    durationSeconds: z.number().nullable(),
    height: z.number().int().nullable(),
    mimeType: z.string(),
    providerUrl: z.url(),
    sizeBytes: z.number().int().nonnegative().nullable(),
    width: z.number().int().nullable(),
  })
  .strict()

/** One leased browser job with no provider credential or server storage secret. */
export const BrowserRunClaimedJobSchema = z
  .object({
    debugOutputs: z
      .array(
        z.discriminatedUnion('delivery', [
          z
            .object({
              delivery: z.literal('text'),
              mimeType: z.literal('text/plain'),
              outputIndex: nonnegativeInteger,
              text: z.string(),
            })
            .strict(),
          z
            .object({
              delivery: z.literal('url'),
              metadata: z.record(
                z.string(),
                z.union([z.boolean(), z.number(), z.string()]),
              ),
              mimeType: z.string(),
              outputIndex: nonnegativeInteger,
              url: z.url(),
            })
            .strict(),
        ]),
      )
      .nullable(),
    executionContract: browserExecutionContractSchema,
    executionMode: z.enum(['debug', 'live']),
    inputAssets: z.array(BrowserRunInputAssetSchema),
    job: z
      .object({
        flowRunId: z.string(),
        id: z.string(),
        itemKey: z.string(),
        mediaType: mediaTypeSchema,
        nodeId: z.string(),
        providerJobId: z.string().nullable(),
        providerSubmittedAt: nullableTimestamp,
        submissionState: browserSubmissionStateSchema,
        status: z.literal('running'),
      })
      .strict(),
    request: BrowserNormalizedGenerationRequestSchema,
  })
  .strict()

/** Strict bounded response returned by the authoritative browser job claim. */
export const BrowserRunClaimResponseSchema = z
  .object({
    jobs: z.array(BrowserRunClaimedJobSchema),
  })
  .strict()

/** Versioned authoritative manifest used to recover active browser runs. */
export const BrowserRunManifestSchema = z
  .object({
    cancellations: z.array(
      z
        .object({
          cancellation: z.enum(['best-effort', 'supported', 'unsupported']),
          executionContract: browserExecutionContractSchema,
          jobId: z.string(),
          providerJobId: z.string().nullable(),
        })
        .strict(),
    ),
    jobs: z.array(
      z
        .object({
          browserAttemptCount: nonnegativeInteger,
          browserNextEligibleAt: nullableTimestamp,
          id: z.string(),
          itemKey: z.string(),
          mediaType: mediaTypeSchema,
          nodeId: z.string(),
          outputCount: z.number().int().positive(),
          provider: z.enum(['fal', 'openrouter']),
          providerJobId: z.string().nullable(),
          providerSubmittedAt: nullableTimestamp,
          requestHash: z.string(),
          requestIndex: nonnegativeInteger,
          submissionState: browserSubmissionStateSchema,
          status: jobStatusSchema,
        })
        .strict(),
    ),
    manifestVersion: z.literal(2),
    run: z
      .object({
        executionMode: z.enum(['debug', 'live']),
        executionRuntime: z.literal('browser'),
        flowRevision: nonnegativeInteger,
        id: z.string(),
        planHash: z.string(),
        snapshotHash: z.string(),
        status: runStatusSchema,
      })
      .strict(),
  })
  .strict()

/** Non-secret IndexedDB record used only to resume authoritative API reads. */
export const BrowserRunRecoveryEntrySchema = z
  .object({
    executorId: z.string(),
    jobId: z.string().nullable(),
    nextEligibleAt: nullableTimestamp,
    organizationId: z.string(),
    outputIndex: nonnegativeInteger.nullable(),
    phase: z.enum([
      'discovering',
      'claimed',
      'submitting',
      'provider-processing',
      'credential-required',
      'cancellation',
      'executor-error',
      'downloading',
      'uploading',
      'finalizing',
      'interrupted',
    ]),
    providerJobId: z.string().nullable(),
    runId: z.string(),
    updatedAt: z.iso.datetime(),
    userId: z.string(),
  })
  .strict()

/** Browser manifest inferred from its strict wire schema. */
export type BrowserRunManifest = z.infer<typeof BrowserRunManifestSchema>
/** Browser job claim inferred from its strict wire schema. */
export type BrowserRunClaimedJob = z.infer<typeof BrowserRunClaimedJobSchema>
/** Safe local recovery record inferred from its strict journal schema. */
export type BrowserRunRecoveryEntry = z.infer<
  typeof BrowserRunRecoveryEntrySchema
>
