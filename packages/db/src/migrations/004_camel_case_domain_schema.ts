import type { Kysely } from 'kysely'

import { sql } from 'kysely'

export async function up(db: Kysely<unknown>) {
  await sql`alter table generation_jobs rename to "generationJobs"`.execute(db)
  await sql`alter table generation_job_characters rename to "generationJobCharacters"`.execute(
    db,
  )
  await sql`alter table generation_job_inputs rename to "generationJobInputs"`.execute(
    db,
  )
  await sql`alter table asset_tags rename to "assetTags"`.execute(db)
  await sql`alter table brand_characters rename to "brandCharacters"`.execute(
    db,
  )
  await sql`alter table project_assets rename to "projectAssets"`.execute(db)
  await sql`alter table project_brands rename to "projectBrands"`.execute(db)
  await sql`alter table project_products rename to "projectProducts"`.execute(
    db,
  )
  await sql`alter table project_characters rename to "projectCharacters"`.execute(
    db,
  )
  await sql`alter table brand_assets rename to "brandAssets"`.execute(db)
  await sql`alter table product_assets rename to "productAssets"`.execute(db)
  await sql`alter table character_assets rename to "characterAssets"`.execute(
    db,
  )

  await sql`alter table brands rename column organization_id to "organizationId"`.execute(
    db,
  )
  await sql`alter table brands rename column created_by to "createdBy"`.execute(
    db,
  )
  await sql`alter table brands rename column tone_of_voice to "toneOfVoice"`.execute(
    db,
  )
  await sql`alter table brands rename column visual_style to "visualStyle"`.execute(
    db,
  )
  await sql`alter table brands rename column do_rules to "doRules"`.execute(db)
  await sql`alter table brands rename column dont_rules to "dontRules"`.execute(
    db,
  )
  await sql`alter table brands rename column created_at to "createdAt"`.execute(
    db,
  )
  await sql`alter table brands rename column updated_at to "updatedAt"`.execute(
    db,
  )

  await sql`alter table products rename column organization_id to "organizationId"`.execute(
    db,
  )
  await sql`alter table products rename column created_by to "createdBy"`.execute(
    db,
  )
  await sql`alter table products rename column brand_id to "brandId"`.execute(
    db,
  )
  await sql`alter table products rename column created_at to "createdAt"`.execute(
    db,
  )
  await sql`alter table products rename column updated_at to "updatedAt"`.execute(
    db,
  )

  await sql`alter table characters rename column organization_id to "organizationId"`.execute(
    db,
  )
  await sql`alter table characters rename column created_by to "createdBy"`.execute(
    db,
  )
  await sql`alter table characters rename column visual_notes to "visualNotes"`.execute(
    db,
  )
  await sql`alter table characters rename column created_at to "createdAt"`.execute(
    db,
  )
  await sql`alter table characters rename column updated_at to "updatedAt"`.execute(
    db,
  )

  await sql`alter table projects rename column organization_id to "organizationId"`.execute(
    db,
  )
  await sql`alter table projects rename column created_by to "createdBy"`.execute(
    db,
  )
  await sql`alter table projects rename column created_at to "createdAt"`.execute(
    db,
  )
  await sql`alter table projects rename column updated_at to "updatedAt"`.execute(
    db,
  )

  await sql`alter table folders rename column organization_id to "organizationId"`.execute(
    db,
  )
  await sql`alter table folders rename column parent_id to "parentId"`.execute(
    db,
  )
  await sql`alter table folders rename column created_at to "createdAt"`.execute(
    db,
  )
  await sql`alter table folders rename column updated_at to "updatedAt"`.execute(
    db,
  )

  await sql`alter table "generationJobs" rename column organization_id to "organizationId"`.execute(
    db,
  )
  await sql`alter table "generationJobs" rename column created_by to "createdBy"`.execute(
    db,
  )
  await sql`alter table "generationJobs" rename column media_type to "mediaType"`.execute(
    db,
  )
  await sql`alter table "generationJobs" rename column app_id to "appId"`.execute(
    db,
  )
  await sql`alter table "generationJobs" rename column resolved_prompt to "resolvedPrompt"`.execute(
    db,
  )
  await sql`alter table "generationJobs" rename column brand_id to "brandId"`.execute(
    db,
  )
  await sql`alter table "generationJobs" rename column product_id to "productId"`.execute(
    db,
  )
  await sql`alter table "generationJobs" rename column project_id to "projectId"`.execute(
    db,
  )
  await sql`alter table "generationJobs" rename column idempotency_key to "idempotencyKey"`.execute(
    db,
  )
  await sql`alter table "generationJobs" rename column request_hash to "requestHash"`.execute(
    db,
  )
  await sql`alter table "generationJobs" rename column credit_source to "creditSource"`.execute(
    db,
  )
  await sql`alter table "generationJobs" rename column credit_cost to "creditCost"`.execute(
    db,
  )
  await sql`alter table "generationJobs" rename column error_code to "errorCode"`.execute(
    db,
  )
  await sql`alter table "generationJobs" rename column error_message to "errorMessage"`.execute(
    db,
  )
  await sql`alter table "generationJobs" rename column provider_job_id to "providerJobId"`.execute(
    db,
  )
  await sql`alter table "generationJobs" rename column cancel_requested_at to "cancelRequestedAt"`.execute(
    db,
  )
  await sql`alter table "generationJobs" rename column created_at to "createdAt"`.execute(
    db,
  )
  await sql`alter table "generationJobs" rename column started_at to "startedAt"`.execute(
    db,
  )
  await sql`alter table "generationJobs" rename column completed_at to "completedAt"`.execute(
    db,
  )

  await sql`alter table assets rename column organization_id to "organizationId"`.execute(
    db,
  )
  await sql`alter table assets rename column created_by to "createdBy"`.execute(
    db,
  )
  await sql`alter table assets rename column storage_key to "storageKey"`.execute(
    db,
  )
  await sql`alter table assets rename column thumbnail_key to "thumbnailKey"`.execute(
    db,
  )
  await sql`alter table assets rename column mime_type to "mimeType"`.execute(
    db,
  )
  await sql`alter table assets rename column size_bytes to "sizeBytes"`.execute(
    db,
  )
  await sql`alter table assets rename column duration_seconds to "durationSeconds"`.execute(
    db,
  )
  await sql`alter table assets rename column folder_id to "folderId"`.execute(
    db,
  )
  await sql`alter table assets rename column generation_job_id to "generationJobId"`.execute(
    db,
  )
  await sql`alter table assets rename column upload_id to "uploadId"`.execute(
    db,
  )
  await sql`alter table assets rename column featured_at to "featuredAt"`.execute(
    db,
  )
  await sql`alter table assets rename column created_at to "createdAt"`.execute(
    db,
  )
  await sql`alter table assets rename column updated_at to "updatedAt"`.execute(
    db,
  )
  await sql`alter table assets rename column deleted_at to "deletedAt"`.execute(
    db,
  )

  await sql`alter table "generationJobCharacters" rename column job_id to "jobId"`.execute(
    db,
  )
  await sql`alter table "generationJobCharacters" rename column character_id to "characterId"`.execute(
    db,
  )
  await sql`alter table "generationJobCharacters" rename column created_at to "createdAt"`.execute(
    db,
  )

  await sql`alter table "generationJobInputs" rename column job_id to "jobId"`.execute(
    db,
  )
  await sql`alter table "generationJobInputs" rename column asset_id to "assetId"`.execute(
    db,
  )
  await sql`alter table "generationJobInputs" rename column sort_order to "sortOrder"`.execute(
    db,
  )

  await sql`alter table tags rename column organization_id to "organizationId"`.execute(
    db,
  )
  await sql`alter table tags rename column created_at to "createdAt"`.execute(
    db,
  )

  await sql`alter table "assetTags" rename column asset_id to "assetId"`.execute(
    db,
  )
  await sql`alter table "assetTags" rename column tag_id to "tagId"`.execute(
    db,
  )
  await sql`alter table "assetTags" rename column created_at to "createdAt"`.execute(
    db,
  )

  await sql`alter table "brandCharacters" rename column brand_id to "brandId"`.execute(
    db,
  )
  await sql`alter table "brandCharacters" rename column character_id to "characterId"`.execute(
    db,
  )
  await sql`alter table "brandCharacters" rename column created_at to "createdAt"`.execute(
    db,
  )

  await sql`alter table "projectAssets" rename column project_id to "projectId"`.execute(
    db,
  )
  await sql`alter table "projectAssets" rename column asset_id to "assetId"`.execute(
    db,
  )
  await sql`alter table "projectAssets" rename column created_at to "createdAt"`.execute(
    db,
  )

  await sql`alter table "projectBrands" rename column project_id to "projectId"`.execute(
    db,
  )
  await sql`alter table "projectBrands" rename column brand_id to "brandId"`.execute(
    db,
  )
  await sql`alter table "projectBrands" rename column created_at to "createdAt"`.execute(
    db,
  )

  await sql`alter table "projectProducts" rename column project_id to "projectId"`.execute(
    db,
  )
  await sql`alter table "projectProducts" rename column product_id to "productId"`.execute(
    db,
  )
  await sql`alter table "projectProducts" rename column created_at to "createdAt"`.execute(
    db,
  )

  await sql`alter table "projectCharacters" rename column project_id to "projectId"`.execute(
    db,
  )
  await sql`alter table "projectCharacters" rename column character_id to "characterId"`.execute(
    db,
  )
  await sql`alter table "projectCharacters" rename column created_at to "createdAt"`.execute(
    db,
  )

  await sql`alter table "brandAssets" rename column brand_id to "brandId"`.execute(
    db,
  )
  await sql`alter table "brandAssets" rename column asset_id to "assetId"`.execute(
    db,
  )
  await sql`alter table "brandAssets" rename column created_at to "createdAt"`.execute(
    db,
  )

  await sql`alter table "productAssets" rename column product_id to "productId"`.execute(
    db,
  )
  await sql`alter table "productAssets" rename column asset_id to "assetId"`.execute(
    db,
  )
  await sql`alter table "productAssets" rename column created_at to "createdAt"`.execute(
    db,
  )

  await sql`alter table "characterAssets" rename column character_id to "characterId"`.execute(
    db,
  )
  await sql`alter table "characterAssets" rename column asset_id to "assetId"`.execute(
    db,
  )
  await sql`alter table "characterAssets" rename column created_at to "createdAt"`.execute(
    db,
  )

  await sql`alter index brands_org_idx rename to "brands_organizationId_idx"`.execute(
    db,
  )
  await sql`alter index products_org_idx rename to "products_organizationId_idx"`.execute(
    db,
  )
  await sql`alter index products_brand_idx rename to "products_brandId_idx"`.execute(
    db,
  )
  await sql`alter index characters_org_idx rename to "characters_organizationId_idx"`.execute(
    db,
  )
  await sql`alter index projects_org_idx rename to "projects_organizationId_idx"`.execute(
    db,
  )
  await sql`alter index folders_org_idx rename to "folders_organizationId_idx"`.execute(
    db,
  )
  await sql`alter index folders_parent_idx rename to "folders_parentId_idx"`.execute(
    db,
  )
  await sql`alter index generation_jobs_org_created_idx rename to "generationJobs_organizationId_createdAt_idx"`.execute(
    db,
  )
  await sql`alter index generation_jobs_active_idx rename to "generationJobs_status_active_idx"`.execute(
    db,
  )
  await sql`alter index generation_jobs_idempotency_idx rename to "generationJobs_organizationId_idempotencyKey_uidx"`.execute(
    db,
  )
  await sql`alter index assets_org_created_idx rename to "assets_organizationId_createdAt_idx"`.execute(
    db,
  )
  await sql`alter index assets_org_type_idx rename to "assets_organizationId_type_idx"`.execute(
    db,
  )
  await sql`alter index assets_folder_idx rename to "assets_folderId_idx"`.execute(
    db,
  )
  await sql`alter index assets_job_idx rename to "assets_generationJobId_idx"`.execute(
    db,
  )
  await sql`alter index assets_upload_id_idx rename to "assets_uploadId_uidx"`.execute(
    db,
  )
  await sql`alter index assets_favorite_idx rename to "assets_organizationId_favorite_idx"`.execute(
    db,
  )
  await sql`alter index generation_job_characters_character_idx rename to "generationJobCharacters_characterId_idx"`.execute(
    db,
  )
  await sql`alter index generation_job_inputs_asset_idx rename to "generationJobInputs_assetId_idx"`.execute(
    db,
  )
  await sql`alter index asset_tags_tag_idx rename to "assetTags_tagId_idx"`.execute(
    db,
  )
  await sql`alter index brand_characters_character_idx rename to "brandCharacters_characterId_idx"`.execute(
    db,
  )
  await sql`alter index project_assets_asset_idx rename to "projectAssets_assetId_idx"`.execute(
    db,
  )
  await sql`alter index project_brands_brand_idx rename to "projectBrands_brandId_idx"`.execute(
    db,
  )
  await sql`alter index project_products_product_idx rename to "projectProducts_productId_idx"`.execute(
    db,
  )
  await sql`alter index project_characters_character_idx rename to "projectCharacters_characterId_idx"`.execute(
    db,
  )
  await sql`alter index brand_assets_asset_idx rename to "brandAssets_assetId_idx"`.execute(
    db,
  )
  await sql`alter index product_assets_asset_idx rename to "productAssets_assetId_idx"`.execute(
    db,
  )
  await sql`alter index character_assets_asset_idx rename to "characterAssets_assetId_idx"`.execute(
    db,
  )
  await sql`alter table tags rename constraint tags_organization_id_name_key to "tags_organizationId_name_key"`.execute(
    db,
  )
}

export async function down(db: Kysely<unknown>) {
  await sql`alter table tags rename constraint "tags_organizationId_name_key" to tags_organization_id_name_key`.execute(
    db,
  )
  await sql`alter index "characterAssets_assetId_idx" rename to character_assets_asset_idx`.execute(
    db,
  )
  await sql`alter index "productAssets_assetId_idx" rename to product_assets_asset_idx`.execute(
    db,
  )
  await sql`alter index "brandAssets_assetId_idx" rename to brand_assets_asset_idx`.execute(
    db,
  )
  await sql`alter index "projectCharacters_characterId_idx" rename to project_characters_character_idx`.execute(
    db,
  )
  await sql`alter index "projectProducts_productId_idx" rename to project_products_product_idx`.execute(
    db,
  )
  await sql`alter index "projectBrands_brandId_idx" rename to project_brands_brand_idx`.execute(
    db,
  )
  await sql`alter index "projectAssets_assetId_idx" rename to project_assets_asset_idx`.execute(
    db,
  )
  await sql`alter index "brandCharacters_characterId_idx" rename to brand_characters_character_idx`.execute(
    db,
  )
  await sql`alter index "assetTags_tagId_idx" rename to asset_tags_tag_idx`.execute(
    db,
  )
  await sql`alter index "generationJobInputs_assetId_idx" rename to generation_job_inputs_asset_idx`.execute(
    db,
  )
  await sql`alter index "generationJobCharacters_characterId_idx" rename to generation_job_characters_character_idx`.execute(
    db,
  )
  await sql`alter index "assets_organizationId_favorite_idx" rename to assets_favorite_idx`.execute(
    db,
  )
  await sql`alter index "assets_uploadId_uidx" rename to assets_upload_id_idx`.execute(
    db,
  )
  await sql`alter index "assets_generationJobId_idx" rename to assets_job_idx`.execute(
    db,
  )
  await sql`alter index "assets_folderId_idx" rename to assets_folder_idx`.execute(
    db,
  )
  await sql`alter index "assets_organizationId_type_idx" rename to assets_org_type_idx`.execute(
    db,
  )
  await sql`alter index "assets_organizationId_createdAt_idx" rename to assets_org_created_idx`.execute(
    db,
  )
  await sql`alter index "generationJobs_organizationId_idempotencyKey_uidx" rename to generation_jobs_idempotency_idx`.execute(
    db,
  )
  await sql`alter index "generationJobs_status_active_idx" rename to generation_jobs_active_idx`.execute(
    db,
  )
  await sql`alter index "generationJobs_organizationId_createdAt_idx" rename to generation_jobs_org_created_idx`.execute(
    db,
  )
  await sql`alter index "folders_parentId_idx" rename to folders_parent_idx`.execute(
    db,
  )
  await sql`alter index "folders_organizationId_idx" rename to folders_org_idx`.execute(
    db,
  )
  await sql`alter index "projects_organizationId_idx" rename to projects_org_idx`.execute(
    db,
  )
  await sql`alter index "characters_organizationId_idx" rename to characters_org_idx`.execute(
    db,
  )
  await sql`alter index "products_brandId_idx" rename to products_brand_idx`.execute(
    db,
  )
  await sql`alter index "products_organizationId_idx" rename to products_org_idx`.execute(
    db,
  )
  await sql`alter index "brands_organizationId_idx" rename to brands_org_idx`.execute(
    db,
  )

  await sql`alter table "characterAssets" rename column "createdAt" to created_at`.execute(
    db,
  )
  await sql`alter table "characterAssets" rename column "assetId" to asset_id`.execute(
    db,
  )
  await sql`alter table "characterAssets" rename column "characterId" to character_id`.execute(
    db,
  )

  await sql`alter table "productAssets" rename column "createdAt" to created_at`.execute(
    db,
  )
  await sql`alter table "productAssets" rename column "assetId" to asset_id`.execute(
    db,
  )
  await sql`alter table "productAssets" rename column "productId" to product_id`.execute(
    db,
  )

  await sql`alter table "brandAssets" rename column "createdAt" to created_at`.execute(
    db,
  )
  await sql`alter table "brandAssets" rename column "assetId" to asset_id`.execute(
    db,
  )
  await sql`alter table "brandAssets" rename column "brandId" to brand_id`.execute(
    db,
  )

  await sql`alter table "projectCharacters" rename column "createdAt" to created_at`.execute(
    db,
  )
  await sql`alter table "projectCharacters" rename column "characterId" to character_id`.execute(
    db,
  )
  await sql`alter table "projectCharacters" rename column "projectId" to project_id`.execute(
    db,
  )

  await sql`alter table "projectProducts" rename column "createdAt" to created_at`.execute(
    db,
  )
  await sql`alter table "projectProducts" rename column "productId" to product_id`.execute(
    db,
  )
  await sql`alter table "projectProducts" rename column "projectId" to project_id`.execute(
    db,
  )

  await sql`alter table "projectBrands" rename column "createdAt" to created_at`.execute(
    db,
  )
  await sql`alter table "projectBrands" rename column "brandId" to brand_id`.execute(
    db,
  )
  await sql`alter table "projectBrands" rename column "projectId" to project_id`.execute(
    db,
  )

  await sql`alter table "projectAssets" rename column "createdAt" to created_at`.execute(
    db,
  )
  await sql`alter table "projectAssets" rename column "assetId" to asset_id`.execute(
    db,
  )
  await sql`alter table "projectAssets" rename column "projectId" to project_id`.execute(
    db,
  )

  await sql`alter table "brandCharacters" rename column "createdAt" to created_at`.execute(
    db,
  )
  await sql`alter table "brandCharacters" rename column "characterId" to character_id`.execute(
    db,
  )
  await sql`alter table "brandCharacters" rename column "brandId" to brand_id`.execute(
    db,
  )

  await sql`alter table "assetTags" rename column "createdAt" to created_at`.execute(
    db,
  )
  await sql`alter table "assetTags" rename column "tagId" to tag_id`.execute(
    db,
  )
  await sql`alter table "assetTags" rename column "assetId" to asset_id`.execute(
    db,
  )

  await sql`alter table tags rename column "createdAt" to created_at`.execute(
    db,
  )
  await sql`alter table tags rename column "organizationId" to organization_id`.execute(
    db,
  )

  await sql`alter table "generationJobInputs" rename column "sortOrder" to sort_order`.execute(
    db,
  )
  await sql`alter table "generationJobInputs" rename column "assetId" to asset_id`.execute(
    db,
  )
  await sql`alter table "generationJobInputs" rename column "jobId" to job_id`.execute(
    db,
  )

  await sql`alter table "generationJobCharacters" rename column "createdAt" to created_at`.execute(
    db,
  )
  await sql`alter table "generationJobCharacters" rename column "characterId" to character_id`.execute(
    db,
  )
  await sql`alter table "generationJobCharacters" rename column "jobId" to job_id`.execute(
    db,
  )

  await sql`alter table assets rename column "deletedAt" to deleted_at`.execute(
    db,
  )
  await sql`alter table assets rename column "updatedAt" to updated_at`.execute(
    db,
  )
  await sql`alter table assets rename column "createdAt" to created_at`.execute(
    db,
  )
  await sql`alter table assets rename column "featuredAt" to featured_at`.execute(
    db,
  )
  await sql`alter table assets rename column "uploadId" to upload_id`.execute(
    db,
  )
  await sql`alter table assets rename column "generationJobId" to generation_job_id`.execute(
    db,
  )
  await sql`alter table assets rename column "folderId" to folder_id`.execute(
    db,
  )
  await sql`alter table assets rename column "durationSeconds" to duration_seconds`.execute(
    db,
  )
  await sql`alter table assets rename column "sizeBytes" to size_bytes`.execute(
    db,
  )
  await sql`alter table assets rename column "mimeType" to mime_type`.execute(
    db,
  )
  await sql`alter table assets rename column "thumbnailKey" to thumbnail_key`.execute(
    db,
  )
  await sql`alter table assets rename column "storageKey" to storage_key`.execute(
    db,
  )
  await sql`alter table assets rename column "createdBy" to created_by`.execute(
    db,
  )
  await sql`alter table assets rename column "organizationId" to organization_id`.execute(
    db,
  )

  await sql`alter table "generationJobs" rename column "completedAt" to completed_at`.execute(
    db,
  )
  await sql`alter table "generationJobs" rename column "startedAt" to started_at`.execute(
    db,
  )
  await sql`alter table "generationJobs" rename column "createdAt" to created_at`.execute(
    db,
  )
  await sql`alter table "generationJobs" rename column "cancelRequestedAt" to cancel_requested_at`.execute(
    db,
  )
  await sql`alter table "generationJobs" rename column "providerJobId" to provider_job_id`.execute(
    db,
  )
  await sql`alter table "generationJobs" rename column "errorMessage" to error_message`.execute(
    db,
  )
  await sql`alter table "generationJobs" rename column "errorCode" to error_code`.execute(
    db,
  )
  await sql`alter table "generationJobs" rename column "creditCost" to credit_cost`.execute(
    db,
  )
  await sql`alter table "generationJobs" rename column "creditSource" to credit_source`.execute(
    db,
  )
  await sql`alter table "generationJobs" rename column "requestHash" to request_hash`.execute(
    db,
  )
  await sql`alter table "generationJobs" rename column "idempotencyKey" to idempotency_key`.execute(
    db,
  )
  await sql`alter table "generationJobs" rename column "projectId" to project_id`.execute(
    db,
  )
  await sql`alter table "generationJobs" rename column "productId" to product_id`.execute(
    db,
  )
  await sql`alter table "generationJobs" rename column "brandId" to brand_id`.execute(
    db,
  )
  await sql`alter table "generationJobs" rename column "resolvedPrompt" to resolved_prompt`.execute(
    db,
  )
  await sql`alter table "generationJobs" rename column "appId" to app_id`.execute(
    db,
  )
  await sql`alter table "generationJobs" rename column "mediaType" to media_type`.execute(
    db,
  )
  await sql`alter table "generationJobs" rename column "createdBy" to created_by`.execute(
    db,
  )
  await sql`alter table "generationJobs" rename column "organizationId" to organization_id`.execute(
    db,
  )

  await sql`alter table folders rename column "updatedAt" to updated_at`.execute(
    db,
  )
  await sql`alter table folders rename column "createdAt" to created_at`.execute(
    db,
  )
  await sql`alter table folders rename column "parentId" to parent_id`.execute(
    db,
  )
  await sql`alter table folders rename column "organizationId" to organization_id`.execute(
    db,
  )

  await sql`alter table projects rename column "updatedAt" to updated_at`.execute(
    db,
  )
  await sql`alter table projects rename column "createdAt" to created_at`.execute(
    db,
  )
  await sql`alter table projects rename column "createdBy" to created_by`.execute(
    db,
  )
  await sql`alter table projects rename column "organizationId" to organization_id`.execute(
    db,
  )

  await sql`alter table characters rename column "updatedAt" to updated_at`.execute(
    db,
  )
  await sql`alter table characters rename column "createdAt" to created_at`.execute(
    db,
  )
  await sql`alter table characters rename column "visualNotes" to visual_notes`.execute(
    db,
  )
  await sql`alter table characters rename column "createdBy" to created_by`.execute(
    db,
  )
  await sql`alter table characters rename column "organizationId" to organization_id`.execute(
    db,
  )

  await sql`alter table products rename column "updatedAt" to updated_at`.execute(
    db,
  )
  await sql`alter table products rename column "createdAt" to created_at`.execute(
    db,
  )
  await sql`alter table products rename column "brandId" to brand_id`.execute(
    db,
  )
  await sql`alter table products rename column "createdBy" to created_by`.execute(
    db,
  )
  await sql`alter table products rename column "organizationId" to organization_id`.execute(
    db,
  )

  await sql`alter table brands rename column "updatedAt" to updated_at`.execute(
    db,
  )
  await sql`alter table brands rename column "createdAt" to created_at`.execute(
    db,
  )
  await sql`alter table brands rename column "dontRules" to dont_rules`.execute(
    db,
  )
  await sql`alter table brands rename column "doRules" to do_rules`.execute(db)
  await sql`alter table brands rename column "visualStyle" to visual_style`.execute(
    db,
  )
  await sql`alter table brands rename column "toneOfVoice" to tone_of_voice`.execute(
    db,
  )
  await sql`alter table brands rename column "createdBy" to created_by`.execute(
    db,
  )
  await sql`alter table brands rename column "organizationId" to organization_id`.execute(
    db,
  )

  await sql`alter table "characterAssets" rename to character_assets`.execute(
    db,
  )
  await sql`alter table "productAssets" rename to product_assets`.execute(db)
  await sql`alter table "brandAssets" rename to brand_assets`.execute(db)
  await sql`alter table "projectCharacters" rename to project_characters`.execute(
    db,
  )
  await sql`alter table "projectProducts" rename to project_products`.execute(
    db,
  )
  await sql`alter table "projectBrands" rename to project_brands`.execute(db)
  await sql`alter table "projectAssets" rename to project_assets`.execute(db)
  await sql`alter table "brandCharacters" rename to brand_characters`.execute(
    db,
  )
  await sql`alter table "assetTags" rename to asset_tags`.execute(db)
  await sql`alter table "generationJobInputs" rename to generation_job_inputs`.execute(
    db,
  )
  await sql`alter table "generationJobCharacters" rename to generation_job_characters`.execute(
    db,
  )
  await sql`alter table "generationJobs" rename to generation_jobs`.execute(db)
}
