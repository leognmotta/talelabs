/** Kysely table, JSON, enum, and database contracts for TaleLabs persistence. */
import type { Generated } from 'kysely'
import type { AssetUploadIntentTable } from './asset-upload-schema.js'
import type {
  AccountTable,
  InvitationTable,
  MemberTable,
  OrganizationTable,
  SessionTable,
  UserTable,
  VerificationTable,
} from './auth-schema.js'
import type {
  BillingDisputeGrantReversalTable,
  BillingPaymentDisputeTable,
  BillingReconciliationCursorTable,
  BillingReconciliationFailureTable,
  BillingSubscriptionChangeIntentTable,
  BillingSubscriptionCheckoutIntentTable,
} from './billing-resilience-schema.js'
import type {
  BillingPaymentTable,
  BillingSubscriptionTable,
  CreditBalanceTable,
  CreditGrantTable,
  CreditLedgerEntryTable,
  CreditPurchaseTable,
  CreditReservationAllocationTable,
  CreditReservationItemTable,
  CreditReservationTable,
  OrganizationBillingAccountTable,
  OrganizationStorageUsageTable,
  StripeWebhookEventTable,
  SubscriptionCreditPeriodTable,
} from './billing-schema.js'
import type { FlowRunBrowserLeaseTable } from './browser-schema.js'
import type {
  GeneratedBigIntColumn,
  GeneratedJsonColumn,
  GeneratedTimestamp,
  JsonValue,
  NullableBigIntColumn,
  NullableNumericColumn,
  NullableTimestamp,
} from './column-types.js'
import type { ProjectBriefTable, ProjectTable } from './projects-schema.js'

export type * from './asset-upload-schema.js'
export type * from './auth-schema.js'
export type * from './billing-resilience-schema.js'
export type * from './billing-schema.js'
export type * from './browser-schema.js'
export type * from './column-types.js'
export type * from './projects-schema.js'
/** Canonical Asset media families. */
export type AssetType = 'audio' | 'document' | 'image' | 'video'
/** Canonical Asset creation sources. */
export type AssetSource = 'generation' | 'upload'
/** Canonical Asset visibility policy. */
export type AssetVisibility = 'private' | 'public'
/** Canonical Asset processing lifecycle. */
export type AssetProcessingState = 'failed' | 'processing' | 'ready'
/** Supported Flow graph-selection run modes. */
export type FlowRunMode
  = | 'all'
    | 'direct'
    | 'downstream'
    | 'node'
    | 'selection'
    | 'tool'
    | 'upstream'
/** Immutable request source for one durable run. */
export type FlowRunSource = 'create' | 'flow'
/** Durable Flow run lifecycle states. */
export type FlowRunStatus
  = | 'canceled'
    | 'failed'
    | 'partial'
    | 'pending'
    | 'running'
    | 'succeeded'
/** Durable per-node Flow run lifecycle states. */
export type FlowRunNodeStatus
  = | 'canceled'
    | 'failed'
    | 'partial'
    | 'pending'
    | 'running'
    | 'skipped'
    | 'succeeded'
/** Media families emitted by generation jobs. */
export type GenerationJobMediaType = 'audio' | 'image' | 'text' | 'video'
/** Durable generation-job lifecycle states. */
export type GenerationJobStatus
  = | 'canceled'
    | 'failed'
    | 'pending'
    | 'running'
    | 'succeeded'
/** Durable provider-output ingestion states. */
export type GenerationProviderOutputStatus = 'discarded' | 'ready' | 'staging'
/** Durable provider settlement states. */
export type GenerationProviderSettlementStatus
  = | 'not_required'
    | 'pending'
    | 'settled'
    | 'unknown'
/** Terminal provider callback completion states. */
export type GenerationProviderCompletionStatus
  = | 'cancelled'
    | 'completed'
    | 'expired'
    | 'failed'
/** Immutable generation input source categories. */
export type GenerationJobSourceType
  = | 'asset'
    | 'element'
    | 'nodeOutput'
    | 'text'
/** Asset and Flow folder table contract. */
export interface FolderTable {
  id: string
  organizationId: string
  /** Optional Project location; null represents Private. */
  projectId: Generated<string | null>
  parentId: string | null
  name: string
  systemRole: Generated<string | null>
  createdAt: GeneratedTimestamp
  updatedAt: GeneratedTimestamp
}

/** Editable Flow identity and viewport table contract. */
export interface FlowTable {
  id: string
  organizationId: string
  /** Optional Project location; null represents Private. */
  projectId: Generated<string | null>
  createdBy: string | null
  name: string
  assetFolderId: string | null
  viewport: GeneratedJsonColumn
  revision: GeneratedBigIntColumn
  createdAt: GeneratedTimestamp
  updatedAt: GeneratedTimestamp
}

/** Lightweight identity grouping related graph-free Create requests. */
export interface CreateSessionTable {
  /** Stable route and history identity. */
  id: string
  /** Tenant owning the session and every related run. */
  organizationId: string
  /** Optional Project location; null represents Private. */
  projectId: Generated<string | null>
  /** User who created and privately lists the session. */
  createdBy: string | null
  /** Optional user-authored label; the UI supplies a localized fallback. */
  name: string | null
  /** Durable default generated-Asset folder for this session. */
  assetFolderId: Generated<string | null>
  /** Initial session creation instant. */
  createdAt: GeneratedTimestamp
  /** Latest rename or admitted direct request instant. */
  updatedAt: GeneratedTimestamp
  /** Soft-delete instant; generated Assets and run provenance remain durable. */
  deletedAt: NullableTimestamp
}

/** Durable immutable Flow run table contract. */
export interface FlowRunTable {
  id: string
  organizationId: string
  createdBy: string | null
  flowId: string | null
  /** Create session grouping direct runs; null for Flow-backed runs. */
  createSessionId: Generated<string | null>
  /** Immutable Project attribution captured during admission. */
  projectId: Generated<string | null>
  /** Immutable generated-Asset folder captured during admission. */
  assetFolderId: Generated<string | null>
  mode: FlowRunMode
  /** Whether immutable work came from a saved Flow or a direct request. */
  source: Generated<FlowRunSource>
  /** Driver selected at admission; existing rows default to managed. */
  executionRuntime: Generated<'browser' | 'managed'>
  /** Credits for managed runs or BYOK for browser runs. */
  fundingSource: Generated<'byok' | 'credits'>
  /** Run-level credit reservation, or null for non-billable execution. */
  creditReservationId: Generated<string | null>
  /** Immutable aggregate credit quote, or null for non-billable execution. */
  creditQuoted: Generated<number | null>
  /** Conservative generated-output bytes still held by this run. */
  storageReservedBytes: GeneratedBigIntColumn
  targetNodeId: string | null
  status: Generated<FlowRunStatus>
  graphSnapshot: GeneratedJsonColumn
  snapshotVersion: Generated<number>
  snapshotHash: string
  executorVersion: string
  idempotencyKey: string
  requestHash: string
  triggerRunId: string | null
  triggerDeploymentVersion: string | null
  retryOfRunId: string | null
  creditCost: number | null
  providerCostUsd: NullableNumericColumn
  errorCode: string | null
  errorMessage: string | null
  lastReconciledAt: NullableTimestamp
  cancellationReconciledAt: NullableTimestamp
  /** Safe browser-driver condition projected to active canvas observers. */
  browserExecutorStatus:
    | 'blocked'
    | 'canceling'
    | 'error'
    | 'ready'
    | 'retrying'
    | null
  /** Stable non-secret reason for the current browser-driver condition. */
  browserExecutorCode: string | null
  /** Database-authored instant of the latest browser-driver condition change. */
  browserExecutorUpdatedAt: NullableTimestamp
  createdAt: GeneratedTimestamp
  startedAt: NullableTimestamp
  completedAt: NullableTimestamp
}

/** Durable generation-job provenance and execution table contract. */
export interface GenerationJobTable {
  id: string
  organizationId: string
  createdBy: string | null
  flowRunId: string
  flowId: string | null
  nodeId: string
  itemKey: string
  requestIndex: Generated<number>
  mediaType: GenerationJobMediaType
  status: Generated<GenerationJobStatus>
  provider: string
  model: string
  operation: string
  providerModel: string
  catalogRevision: string
  providerRouteVersion: string
  adapterVersion: string
  settings: GeneratedJsonColumn
  resolvedPrompt: string | null
  idempotencyKey: string
  requestHash: string
  requestPayload: JsonValue
  triggerRunId: string | null
  providerEndpoint: string | null
  providerEndpointTag: string | null
  providerGenerationId: string | null
  providerLifecycle: JsonValue | null
  providerSubmittedAt: NullableTimestamp
  providerJobId: string | null
  providerWaitTokenId: string | null
  providerCompletionStatus: GenerationProviderCompletionStatus | null
  providerCompletionEventId: string | null
  providerCompletionReceivedAt: NullableTimestamp
  providerSettlementResolvedAt: NullableTimestamp
  providerSettlementStatus: Generated<GenerationProviderSettlementStatus>
  /** Browser retry attempt count; managed retries remain owned by Trigger.dev. */
  browserAttemptCount: Generated<number>
  /** Lease generation that most recently claimed this browser job. */
  browserFenceToken: number | null
  /** One-shot provider submission boundary for takeover-safe recovery. */
  browserSubmissionState: Generated<'not_started' | 'submitted' | 'submitting'>
  /** User cancellation instant recorded before browser-side provider cancellation. */
  browserCancelRequestedAt: NullableTimestamp
  /** Durable instant when the browser reported a provider cancellation outcome. */
  browserCancelAcknowledgedAt: NullableTimestamp
  /** Safe provider cancellation outcome reported by the browser executor. */
  browserCancelStatus:
    | 'accepted'
    | 'rejected'
    | 'unavailable'
    | 'unsupported'
    | null
  /** Whether the reported cancellation outcome requires no further provider work. */
  browserCancelFinal: boolean | null
  /** Database-authored instant after which browser claiming may retry. */
  browserNextEligibleAt: NullableTimestamp
  creditCost: number | null
  /** Immutable whole-credit admission quote. */
  creditQuoted: Generated<number | null>
  /** Catalog revision defining the credit quote. */
  creditPricingVersion: string | null
  /** Idempotent customer-credit settlement lifecycle. */
  creditSettlement: Generated<
    'captured' | 'not_applicable' | 'released' | 'reserved'
  >
  /** Failed scheduled-settlement attempts since the last successful transition. */
  creditSettlementReconciliationAttempts: Generated<number>
  /** Most recent failed scheduled-settlement attempt. */
  creditSettlementReconciliationAttemptedAt: NullableTimestamp
  /** Stable non-secret classification for the latest settlement failure. */
  creditSettlementReconciliationErrorCode: string | null
  /** Earliest instant when the failed settlement may retry. */
  creditSettlementReconciliationNextAt: NullableTimestamp
  /** Terminal retry exhaustion requiring operator review. */
  creditSettlementReconciliationQuarantinedAt: NullableTimestamp
  /** Immutable generated Asset visibility captured at admission. */
  outputVisibility: Generated<'private' | 'public'>
  /** Immutable generated Asset showcase eligibility captured at admission. */
  showcaseEligible: Generated<boolean>
  /** Conservative generated-output bytes held for this job. */
  storageReservedBytes: GeneratedBigIntColumn
  /** Immutable admission-time quote; null when deterministic pricing was unavailable. */
  providerCostEstimate: JsonValue | null
  providerCostUsd: NullableNumericColumn
  /** Informational browser-reported cost that is never trusted for billing. */
  browserReportedProviderCostUsd: NullableNumericColumn
  /** Informational browser-reported generation identity awaiting independent trust. */
  browserReportedProviderGenerationId: string | null
  providerCostReconciliationAttempts: Generated<number>
  providerCostReconciliationAttemptedAt: NullableTimestamp
  errorCode: string | null
  errorMessage: string | null
  lastReconciledAt: NullableTimestamp
  createdAt: GeneratedTimestamp
  startedAt: NullableTimestamp
  completedAt: NullableTimestamp
}

/** Immutable normalized provider-result checkpoint table contract. */
export interface GenerationProviderResultTable {
  organizationId: string
  jobId: string
  expectedOutputCount: number
  providerGenerationId: string | null
  providerCostUsd: NullableNumericColumn
  createdAt: GeneratedTimestamp
}

/** Durable provider-output ingestion checkpoint table contract. */
export interface GenerationProviderOutputTable {
  organizationId: string
  jobId: string
  outputIndex: number
  mediaType: GenerationJobMediaType
  status: Generated<GenerationProviderOutputStatus>
  delivery: 'storage' | 'text'
  mimeType: string | null
  storageBucket: string | null
  storageKey: string | null
  text: string | null
  metadata: GeneratedJsonColumn
  createdAt: GeneratedTimestamp
  updatedAt: GeneratedTimestamp
}

/** Durable per-node Flow run summary table contract. */
export interface FlowRunNodeTable {
  organizationId: string
  flowRunId: string
  nodeId: string
  status: Generated<FlowRunNodeStatus>
  createdAt: GeneratedTimestamp
  updatedAt: GeneratedTimestamp
}

/** Durable materialized Flow runtime-item table contract. */
export interface FlowRunNodeItemTable {
  organizationId: string
  flowRunId: string
  nodeId: string
  itemKey: string
  sortOrder: number
  dimensions: GeneratedJsonColumn
  lineage: GeneratedJsonColumn
  status: Generated<FlowRunNodeStatus>
  createdAt: GeneratedTimestamp
  updatedAt: GeneratedTimestamp
}

/** Persisted generation text-output table contract. */
export interface GenerationJobTextOutputTable {
  organizationId: string
  jobId: string
  outputIndex: number
  text: string
}

/** Canonical Asset table contract. */
export interface AssetTable {
  id: string
  organizationId: string
  /** Optional Project location; null represents Private. */
  projectId: Generated<string | null>
  createdBy: string | null
  name: string
  type: AssetType
  source: AssetSource
  visibility: Generated<AssetVisibility>
  /** Immutable eligibility for separately moderated showcase selection. */
  showcaseEligible: Generated<boolean>
  storageKey: string
  thumbnailKey: string | null
  mimeType: string
  sizeBytes: NullableBigIntColumn
  width: number | null
  height: number | null
  durationSeconds: NullableNumericColumn
  folderId: string | null
  generationJobId: string | null
  outputIndex: number | null
  uploadId: string | null
  metadata: GeneratedJsonColumn
  processingState: Generated<AssetProcessingState>
  processingError: string | null
  createdAt: GeneratedTimestamp
  updatedAt: GeneratedTimestamp
  deletedAt: NullableTimestamp
  purgeRequestedAt: NullableTimestamp
  purgedAt: NullableTimestamp
}

/** User-owned Asset favorite relationship table contract. */
export interface AssetFavoriteTable {
  organizationId: string
  userId: string
  assetId: string
  createdAt: GeneratedTimestamp
}

/** Organization-scoped Asset tag table contract. */
export interface TagTable {
  id: string
  organizationId: string
  createdBy: string | null
  name: string
  normalizedName: string
  createdAt: GeneratedTimestamp
  updatedAt: GeneratedTimestamp
}

/** Asset-to-tag relationship table contract. */
export interface AssetTagTable {
  organizationId: string
  assetId: string
  tagId: string
  createdBy: string | null
  createdAt: GeneratedTimestamp
}

/**
 * Element table contract. An Element is a named, reusable collection of
 * reference image Assets; `kind` is a presentation label owned by the code
 * registry and is never constrained by the database.
 */
export interface ElementTable {
  id: string
  organizationId: string
  /** Optional Project location; null represents Private. */
  projectId: Generated<string | null>
  createdBy: string | null
  kind: string
  name: string
  description: Generated<string>
  createdAt: GeneratedTimestamp
  updatedAt: GeneratedTimestamp
}

/**
 * Element-to-Asset reference table contract. Rows are ordered by `sortOrder`;
 * the first reference is the Element's cover image.
 */
export interface ElementReferenceTable {
  organizationId: string
  elementId: string
  assetId: string
  sortOrder: Generated<number>
  createdAt: GeneratedTimestamp
}

/** Persisted editable Flow node table contract. */
export interface FlowNodeTable {
  id: string
  organizationId: string
  flowId: string
  type: string
  positionX: number
  positionY: number
  assetId: string | null
  data: GeneratedJsonColumn
  schemaVersion: Generated<number>
  createdAt: GeneratedTimestamp
  updatedAt: GeneratedTimestamp
}

/** Persisted editable Flow edge table contract. */
export interface FlowEdgeTable {
  id: string
  flowId: string
  sourceNodeId: string
  targetNodeId: string
  sourceHandle: string | null
  targetHandle: string | null
  createdAt: GeneratedTimestamp
}

/** Immutable generation source-lineage table contract. */
export interface GenerationJobSourceTable {
  id: string
  organizationId: string
  jobId: string
  sortOrder: number
  sourceType: GenerationJobSourceType
  nodeId: string
  elementId: string | null
  assetId: string | null
  resolvedText: string | null
  snapshot: GeneratedJsonColumn
}

/** Immutable exact generation Asset-input table contract. */
export interface GenerationJobInputTable {
  organizationId: string
  jobId: string
  assetId: string
  sourceId: string | null
  role: Generated<string>
  sortOrder: number
}

/** Complete Kysely database map for TaleLabs PostgreSQL tables. */
export interface Database {
  account: AccountTable
  assetFavorites: AssetFavoriteTable
  assetTags: AssetTagTable
  assetUploadIntents: AssetUploadIntentTable
  assets: AssetTable
  billingDisputeGrantReversals: BillingDisputeGrantReversalTable
  billingPaymentDisputes: BillingPaymentDisputeTable
  billingPayments: BillingPaymentTable
  billingReconciliationCursors: BillingReconciliationCursorTable
  billingReconciliationFailures: BillingReconciliationFailureTable
  billingSubscriptionChangeIntents: BillingSubscriptionChangeIntentTable
  billingSubscriptionCheckoutIntents: BillingSubscriptionCheckoutIntentTable
  billingSubscriptions: BillingSubscriptionTable
  createSessions: CreateSessionTable
  creditBalances: CreditBalanceTable
  creditGrants: CreditGrantTable
  creditLedgerEntries: CreditLedgerEntryTable
  creditPurchases: CreditPurchaseTable
  creditReservationAllocations: CreditReservationAllocationTable
  creditReservationItems: CreditReservationItemTable
  creditReservations: CreditReservationTable
  elementReferences: ElementReferenceTable
  elements: ElementTable
  flowEdges: FlowEdgeTable
  flowNodes: FlowNodeTable
  flowRunNodeItems: FlowRunNodeItemTable
  flowRunNodes: FlowRunNodeTable
  flowRuns: FlowRunTable
  flowRunBrowserLeases: FlowRunBrowserLeaseTable
  flows: FlowTable
  folders: FolderTable
  generationJobInputs: GenerationJobInputTable
  generationJobSources: GenerationJobSourceTable
  generationJobTextOutputs: GenerationJobTextOutputTable
  generationJobs: GenerationJobTable
  generationProviderOutputs: GenerationProviderOutputTable
  generationProviderResults: GenerationProviderResultTable
  invitation: InvitationTable
  member: MemberTable
  organization: OrganizationTable
  organizationBillingAccounts: OrganizationBillingAccountTable
  organizationStorageUsage: OrganizationStorageUsageTable
  projectBriefs: ProjectBriefTable
  projects: ProjectTable
  session: SessionTable
  stripeWebhookEvents: StripeWebhookEventTable
  subscriptionCreditPeriods: SubscriptionCreditPeriodTable
  tags: TagTable
  user: UserTable
  verification: VerificationTable
}
