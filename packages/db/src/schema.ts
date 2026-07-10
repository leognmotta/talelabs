import type { ColumnType, Generated } from 'kysely'

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
type NullableBigInt = ColumnType<
  string | null,
  bigint | number | string | null | undefined,
  bigint | number | string | null
>
type NullableNumeric = ColumnType<
  string | null,
  number | string | null | undefined,
  number | string | null
>

export type JsonValue = JsonPrimitive | JsonObject | JsonValue[]
export type JsonPrimitive = boolean | number | string | null

export interface JsonObject {
  [key: string]: JsonValue
}

export interface BrandColor extends JsonObject {
  hex: string
  name: string
}

export type GenerationMediaType = 'audio' | 'image' | 'video'
export type GenerationJobStatus
  = | 'canceled'
    | 'failed'
    | 'pending'
    | 'running'
    | 'succeeded'
export type GenerationCreditSource
  = | 'promotional'
    | 'subscription'
    | 'top_up'
    | 'unmetered'
export type AssetType = 'audio' | 'document' | 'font' | 'image' | 'video'
export type AssetSource = 'export' | 'generation' | 'upload'
export type AssetVisibility = 'private' | 'public'
export type GenerationJobInputRole
  = | 'audio_reference'
    | 'first_frame'
    | 'last_frame'
    | 'reference'
    | 'source_image'
export type BrandAssetRole
  = | 'approved_output'
    | 'logo_dark'
    | 'logo_horizontal'
    | 'logo_icon'
    | 'logo_light'
    | 'logo_mono'
    | 'logo_primary'
    | 'logo_wordmark'
    | 'reference'
export type ProductAssetRole
  = | 'approved_output'
    | 'lifestyle'
    | 'packaging'
    | 'reference'
    | 'source_image'
export type CharacterAssetRole
  = | 'approved_output'
    | 'expression_sheet'
    | 'pose_sheet'
    | 'reference_image'
    | 'sample_audio'
    | 'sample_video'
    | 'voice_reference'

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

export interface BrandTable {
  id: string
  organizationId: string
  createdBy: string | null
  name: string
  description: string | null
  toneOfVoice: string | null
  visualStyle: string | null
  doRules: string | null
  dontRules: string | null
  colors: Generated<BrandColor[]>
  createdAt: GeneratedTimestamp
  updatedAt: GeneratedTimestamp
}

export interface ProductTable {
  id: string
  organizationId: string
  createdBy: string | null
  brandId: string | null
  name: string
  description: string | null
  features: Generated<string[]>
  benefits: Generated<string[]>
  createdAt: GeneratedTimestamp
  updatedAt: GeneratedTimestamp
}

export interface CharacterTable {
  id: string
  organizationId: string
  createdBy: string | null
  name: string
  role: string | null
  description: string | null
  personality: string | null
  visualNotes: string | null
  createdAt: GeneratedTimestamp
  updatedAt: GeneratedTimestamp
}

export interface ProjectTable {
  id: string
  organizationId: string
  createdBy: string | null
  name: string
  description: string | null
  createdAt: GeneratedTimestamp
  updatedAt: GeneratedTimestamp
}

export interface FolderTable {
  id: string
  organizationId: string
  parentId: string | null
  name: string
  createdAt: GeneratedTimestamp
  updatedAt: GeneratedTimestamp
}

export interface GenerationJobTable {
  id: string
  organizationId: string
  createdBy: string | null
  mediaType: GenerationMediaType
  status: Generated<GenerationJobStatus>
  provider: string
  model: string
  appId: string | null
  prompt: string | null
  resolvedPrompt: string | null
  settings: Generated<JsonObject>
  brandId: string | null
  productId: string | null
  projectId: string | null
  idempotencyKey: string
  requestHash: string
  creditSource: Generated<GenerationCreditSource>
  creditCost: number | null
  errorCode: string | null
  errorMessage: string | null
  providerJobId: string | null
  cancelRequestedAt: NullableTimestamp
  createdAt: GeneratedTimestamp
  startedAt: NullableTimestamp
  completedAt: NullableTimestamp
}

export interface AssetTable {
  id: string
  organizationId: string
  createdBy: string | null
  name: string
  type: AssetType
  source: AssetSource
  storageKey: string
  visibility: Generated<AssetVisibility>
  thumbnailKey: string | null
  mimeType: string
  sizeBytes: NullableBigInt
  width: number | null
  height: number | null
  durationSeconds: NullableNumeric
  folderId: string | null
  generationJobId: string | null
  uploadId: string | null
  favorite: Generated<boolean>
  featuredAt: NullableTimestamp
  metadata: Generated<JsonObject>
  createdAt: GeneratedTimestamp
  updatedAt: GeneratedTimestamp
  deletedAt: NullableTimestamp
}

export interface GenerationJobCharacterTable {
  jobId: string
  characterId: string
  createdAt: GeneratedTimestamp
}

export interface GenerationJobInputTable {
  jobId: string
  assetId: string
  role: Generated<GenerationJobInputRole>
  sortOrder: Generated<number>
}

export interface TagTable {
  id: string
  organizationId: string
  name: string
  createdAt: GeneratedTimestamp
}

export interface AssetTagTable {
  assetId: string
  tagId: string
  createdAt: GeneratedTimestamp
}

export interface BrandCharacterTable {
  brandId: string
  characterId: string
  createdAt: GeneratedTimestamp
}

export interface ProjectAssetTable {
  projectId: string
  assetId: string
  createdAt: GeneratedTimestamp
}

export interface ProjectBrandTable {
  projectId: string
  brandId: string
  createdAt: GeneratedTimestamp
}

export interface ProjectProductTable {
  projectId: string
  productId: string
  createdAt: GeneratedTimestamp
}

export interface ProjectCharacterTable {
  projectId: string
  characterId: string
  createdAt: GeneratedTimestamp
}

export interface BrandAssetTable {
  brandId: string
  assetId: string
  role: Generated<BrandAssetRole>
  createdAt: GeneratedTimestamp
}

export interface ProductAssetTable {
  productId: string
  assetId: string
  role: Generated<ProductAssetRole>
  createdAt: GeneratedTimestamp
}

export interface CharacterAssetTable {
  characterId: string
  assetId: string
  role: Generated<CharacterAssetRole>
  createdAt: GeneratedTimestamp
}

export interface Database {
  account: AccountTable
  assetTags: AssetTagTable
  assets: AssetTable
  brandAssets: BrandAssetTable
  brandCharacters: BrandCharacterTable
  brands: BrandTable
  characterAssets: CharacterAssetTable
  characters: CharacterTable
  folders: FolderTable
  generationJobCharacters: GenerationJobCharacterTable
  generationJobInputs: GenerationJobInputTable
  generationJobs: GenerationJobTable
  invitation: InvitationTable
  member: MemberTable
  organization: OrganizationTable
  productAssets: ProductAssetTable
  products: ProductTable
  projectAssets: ProjectAssetTable
  projectBrands: ProjectBrandTable
  projectCharacters: ProjectCharacterTable
  projectProducts: ProjectProductTable
  projects: ProjectTable
  session: SessionTable
  tags: TagTable
  user: UserTable
  verification: VerificationTable
}
