/** Kysely table, JSON, enum, and database contracts for TaleLabs persistence. */

import type { ColumnType, Generated } from 'kysely'

/** Scalar values accepted by PostgreSQL JSON columns. */
export type JsonPrimitive = boolean | null | number | string
/** Recursive values accepted by PostgreSQL JSON columns. */
export type JsonValue = JsonArray | JsonObject | JsonPrimitive
/** Recursive JSON array contract. */
export interface JsonArray extends Array<JsonValue> {}
/** Recursive JSON object contract. */
export interface JsonObject {
  [key: string]: JsonValue | undefined
}

type Timestamp = ColumnType<Date, Date | string, Date | string>
type GeneratedTimestamp = ColumnType<
  Date,
  Date | string | undefined,
  Date | string
>
type NullableTimestamp = ColumnType<
  Date | null,
  Date | string | null | undefined,
  Date | string | null
>
type GeneratedJsonColumn = ColumnType<
  JsonValue,
  JsonValue | string | undefined,
  JsonValue | string
>
type GeneratedBigIntColumn = ColumnType<
  string,
  bigint | number | string | undefined,
  bigint | number | string
>
type NullableBigIntColumn = ColumnType<
  string | null,
  bigint | number | string | null | undefined,
  bigint | number | string | null
>
type NullableNumericColumn = ColumnType<
  string | null,
  number | string | null | undefined,
  number | string | null
>

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
    | 'downstream'
    | 'node'
    | 'selection'
    | 'tool'
    | 'upstream'
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
/** Better Auth user table contract. */
export interface UserTable {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image: string | null
  role: string
  banned: boolean
  banReason: string | null
  banExpires: Timestamp | null
  locale: string | null
  createdAt: GeneratedTimestamp
  updatedAt: GeneratedTimestamp
}

/** Better Auth session table contract. */
export interface SessionTable {
  id: string
  expiresAt: Timestamp
  token: string
  createdAt: GeneratedTimestamp
  updatedAt: Timestamp
  ipAddress: string | null
  userAgent: string | null
  userId: string
  activeOrganizationId: string | null
  impersonatedBy: string | null
}

/** Better Auth linked-account table contract. */
export interface AccountTable {
  id: string
  accountId: string
  providerId: string
  userId: string
  accessToken: string | null
  refreshToken: string | null
  idToken: string | null
  accessTokenExpiresAt: Timestamp | null
  refreshTokenExpiresAt: Timestamp | null
  scope: string | null
  password: string | null
  createdAt: GeneratedTimestamp
  updatedAt: Timestamp
}

/** Better Auth verification-token table contract. */
export interface VerificationTable {
  id: string
  identifier: string
  value: string
  expiresAt: Timestamp
  createdAt: GeneratedTimestamp
  updatedAt: GeneratedTimestamp
}

/** Better Auth organization table contract. */
export interface OrganizationTable {
  id: string
  name: string
  slug: string
  logo: string | null
  createdAt: Timestamp
  metadata: string | null
}

/** Better Auth organization membership table contract. */
export interface MemberTable {
  id: string
  organizationId: string
  userId: string
  role: string
  createdAt: Timestamp
}

/** Better Auth organization invitation table contract. */
export interface InvitationTable {
  id: string
  organizationId: string
  email: string
  role: string | null
  status: string
  expiresAt: Timestamp
  createdAt: GeneratedTimestamp
  inviterId: string
}

/** Asset and Flow folder table contract. */
export interface FolderTable {
  id: string
  organizationId: string
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
  createdBy: string | null
  name: string
  assetFolderId: string | null
  viewport: GeneratedJsonColumn
  revision: GeneratedBigIntColumn
  createdAt: GeneratedTimestamp
  updatedAt: GeneratedTimestamp
}

/** Durable immutable Flow run table contract. */
export interface FlowRunTable {
  id: string
  organizationId: string
  createdBy: string | null
  flowId: string | null
  mode: FlowRunMode
  /** Driver selected at admission; existing rows default to managed. */
  executionRuntime: Generated<'browser' | 'managed'>
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

/** Authoritative browser executor ownership for one tenant-scoped run. */
export interface FlowRunBrowserLeaseTable {
  /** Tenant owning both the lease and its run. */
  organizationId: string
  /** Browser-executed run under exclusive server ownership. */
  flowRunId: string
  /** Authenticated user allowed to renew and exercise the lease. */
  userId: string
  /** Opaque tab-scoped executor identity; never a credential. */
  executorId: string
  /** Monotonic ownership generation used to reject stale browser mutations. */
  fenceToken: Generated<number>
  /** Instant after which another browser executor may take over. */
  leaseExpiresAt: Timestamp
  /** Database-authored instant of the latest successful heartbeat. */
  heartbeatAt: Timestamp
  /** First ownership record creation instant. */
  createdAt: GeneratedTimestamp
  /** Most recent acquisition or heartbeat instant. */
  updatedAt: GeneratedTimestamp
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
  createdBy: string | null
  name: string
  type: AssetType
  source: AssetSource
  visibility: Generated<AssetVisibility>
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
  assets: AssetTable
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
  session: SessionTable
  tags: TagTable
  user: UserTable
  verification: VerificationTable
}
