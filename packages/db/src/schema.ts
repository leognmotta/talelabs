import type { ColumnType, Generated } from 'kysely'

export type JsonPrimitive = boolean | null | number | string
export type JsonValue = JsonArray | JsonObject | JsonPrimitive
export interface JsonArray extends Array<JsonValue> {}
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

export type AssetType = 'audio' | 'document' | 'image' | 'video'
export type AssetSource = 'generation' | 'upload'
export type AssetProcessingState = 'failed' | 'processing' | 'ready'
export type ElementReferenceKind = 'master' | 'source'
export type FlowRunMode = 'all' | 'downstream' | 'node' | 'tool'
export type FlowRunStatus
  = | 'canceled'
    | 'failed'
    | 'partial'
    | 'pending'
    | 'running'
    | 'succeeded'
export type FlowRunNodeStatus
  = | 'canceled'
    | 'failed'
    | 'pending'
    | 'running'
    | 'skipped'
    | 'succeeded'
export type GenerationJobMediaType = 'audio' | 'image' | 'video'
export type GenerationJobStatus
  = | 'canceled'
    | 'failed'
    | 'pending'
    | 'running'
    | 'succeeded'
export type GenerationJobSourceType
  = | 'asset'
    | 'element'
    | 'nodeOutput'
    | 'text'
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

export interface VerificationTable {
  id: string
  identifier: string
  value: string
  expiresAt: Timestamp
  createdAt: GeneratedTimestamp
  updatedAt: GeneratedTimestamp
}

export interface OrganizationTable {
  id: string
  name: string
  slug: string
  logo: string | null
  createdAt: Timestamp
  metadata: string | null
}

export interface MemberTable {
  id: string
  organizationId: string
  userId: string
  role: string
  createdAt: Timestamp
}

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

export interface FolderTable {
  id: string
  organizationId: string
  parentId: string | null
  name: string
  systemRole: Generated<string | null>
  createdAt: GeneratedTimestamp
  updatedAt: GeneratedTimestamp
}

export interface FlowTable {
  id: string
  organizationId: string
  createdBy: string | null
  name: string
  viewport: GeneratedJsonColumn
  revision: GeneratedBigIntColumn
  createdAt: GeneratedTimestamp
  updatedAt: GeneratedTimestamp
}

export interface FlowRunTable {
  id: string
  organizationId: string
  createdBy: string | null
  flowId: string | null
  mode: FlowRunMode
  targetNodeId: string | null
  status: Generated<FlowRunStatus>
  graphSnapshot: GeneratedJsonColumn
  snapshotVersion: Generated<number>
  idempotencyKey: string
  requestHash: string
  triggerRunId: string | null
  creditCost: number | null
  errorCode: string | null
  errorMessage: string | null
  createdAt: GeneratedTimestamp
  startedAt: NullableTimestamp
  completedAt: NullableTimestamp
}

export interface GenerationJobTable {
  id: string
  organizationId: string
  createdBy: string | null
  flowRunId: string
  flowId: string | null
  nodeId: string
  mediaType: GenerationJobMediaType
  status: Generated<GenerationJobStatus>
  provider: string
  model: string
  settings: GeneratedJsonColumn
  resolvedPrompt: string | null
  idempotencyKey: string
  requestHash: string
  triggerRunId: string | null
  providerSubmittedAt: NullableTimestamp
  providerJobId: string | null
  creditCost: number | null
  providerCostUsd: NullableNumericColumn
  errorCode: string | null
  errorMessage: string | null
  createdAt: GeneratedTimestamp
  startedAt: NullableTimestamp
  completedAt: NullableTimestamp
}

export interface FlowRunNodeTable {
  organizationId: string
  flowRunId: string
  nodeId: string
  status: Generated<FlowRunNodeStatus>
  jobId: string | null
  createdAt: GeneratedTimestamp
  updatedAt: GeneratedTimestamp
}

export interface AssetTable {
  id: string
  organizationId: string
  createdBy: string | null
  name: string
  type: AssetType
  source: AssetSource
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

export interface AssetFavoriteTable {
  organizationId: string
  userId: string
  assetId: string
  createdAt: GeneratedTimestamp
}

export interface TagTable {
  id: string
  organizationId: string
  createdBy: string | null
  name: string
  normalizedName: string
  createdAt: GeneratedTimestamp
  updatedAt: GeneratedTimestamp
}

export interface AssetTagTable {
  organizationId: string
  assetId: string
  tagId: string
  createdBy: string | null
  createdAt: GeneratedTimestamp
}

export interface ElementTable {
  id: string
  organizationId: string
  createdBy: string | null
  assetFolderId: Generated<string | null>
  type: string
  name: string
  instructions: string | null
  data: GeneratedJsonColumn
  schemaVersion: Generated<number>
  createdAt: GeneratedTimestamp
  updatedAt: GeneratedTimestamp
}

export interface ElementAssetTable {
  organizationId: string
  elementId: string
  assetId: string
  role: string
  sortOrder: Generated<number>
  isPrimary: Generated<boolean>
  referenceKind: Generated<ElementReferenceKind>
  referenceMetadata: GeneratedJsonColumn
  createdAt: GeneratedTimestamp
}

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

export interface FlowEdgeTable {
  id: string
  flowId: string
  sourceNodeId: string
  targetNodeId: string
  sourceHandle: string | null
  targetHandle: string | null
  createdAt: GeneratedTimestamp
}

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

export interface GenerationJobInputTable {
  organizationId: string
  jobId: string
  assetId: string
  sourceId: string | null
  role: Generated<string>
  sortOrder: number
}

export interface Database {
  account: AccountTable
  assetFavorites: AssetFavoriteTable
  assetTags: AssetTagTable
  assets: AssetTable
  elementAssets: ElementAssetTable
  elements: ElementTable
  flowEdges: FlowEdgeTable
  flowNodes: FlowNodeTable
  flowRunNodes: FlowRunNodeTable
  flowRuns: FlowRunTable
  flows: FlowTable
  folders: FolderTable
  generationJobInputs: GenerationJobInputTable
  generationJobSources: GenerationJobSourceTable
  generationJobs: GenerationJobTable
  invitation: InvitationTable
  member: MemberTable
  organization: OrganizationTable
  session: SessionTable
  tags: TagTable
  user: UserTable
  verification: VerificationTable
}
