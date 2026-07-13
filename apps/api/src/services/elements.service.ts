import type { JsonValue } from '@talelabs/db'
import type { ElementType } from '@talelabs/elements'
import type { ZodError } from 'zod'

import { createId } from '@paralleldrive/cuid2'
import {
  getElementAssetRoles,
  getElementTypeDefinition,
  isElementType,
  parseElementData,
  upcastElementData,
} from '@talelabs/elements'

import {
  countElementAssetsByRole,
  createElementAssetLinkRow,
  deleteElementAssetLinkRow,
  deleteElementRow,
  findElementById,
  getElementUsageRows,
  insertElementWithAssetFolderRow,
  listElementAssetRows,
  listElementPreviewAssets,
  listElementRows,
  updateElementAssetLinkRow,
  updateElementRow,
} from '../data/elements.data.js'
import {
  createElementAssetMediaTypeNotAcceptedError,
  createElementAssetRoleNotFoundError,
  requireElementAssetRole,
} from '../domain/elements/element-asset-role-policy.js'
import { ELEMENT_PREVIEW_ROLES } from '../domain/elements/element-preview-roles.js'
import { HttpError, TenantResourceNotFoundError } from '../middleware/error.js'
import {
  buildCursorPage,
  parseIsoTimestampCursorValue,
  resolvePagination,
} from '../pagination/pagination.js'
import { createAssetThumbnailUrl, toWireJsonObject } from './asset-presenter.js'
import { presentAssetsForUser } from './assets.service.js'
import { createElementAssetRoleCapacityError } from './element-asset-limit-error.js'
import { assertElementFlowReferenceBudgets } from './flow-reference-budget.js'

function validationDetails(error: ZodError, prefix = 'data') {
  return error.issues.map(issue => ({
    code: issue.code,
    field: [prefix, ...issue.path.map(String)].filter(Boolean).join('.'),
    message: issue.message,
  }))
}

function parseData(type: ElementType, data: unknown, schemaVersion?: number) {
  try {
    return schemaVersion === undefined
      ? parseElementData(type, data)
      : upcastElementData(type, schemaVersion, data).data
  }
  catch (error) {
    if (error && typeof error === 'object' && 'issues' in error) {
      throw new HttpError(
        400,
        'validation_error',
        'The Element data could not be validated.',
        validationDetails(error as ZodError),
      )
    }
    throw error
  }
}

function requireStoredElementType(type: string): ElementType {
  if (!isElementType(type))
    throw new Error(`Stored Element type is not registered: ${type}`)
  return type
}

export function presentElement(element: NonNullable<Awaited<ReturnType<typeof findElementById>>>) {
  const type = requireStoredElementType(element.type)
  const upcasted = upcastElementData(type, element.schemaVersion, element.data)

  return {
    id: element.id,
    type,
    name: element.name,
    assetFolderId: element.assetFolderId,
    instructions: element.instructions,
    data: toWireJsonObject(upcasted.data),
    schemaVersion: upcasted.schemaVersion,
    createdBy: element.createdBy,
    createdAt: element.createdAt.toISOString(),
    updatedAt: element.updatedAt.toISOString(),
  }
}

export async function listElements(input: {
  cursor?: string
  limit: number
  organizationId: string
  search?: string
  type?: ElementType
}) {
  const pagination = resolvePagination({
    cursor: input.cursor,
    limit: input.limit,
  }, {
    cursorValueParsers: { updatedAt: parseIsoTimestampCursorValue },
    defaultOrder: 'desc',
    defaultSort: 'updatedAt',
  })
  if (!pagination.ok)
    throw new HttpError(400, 'validation_error', 'The pagination options are invalid.', pagination.details)

  const rows = await listElementRows({
    ...input,
    cursor: pagination.value.cursor,
    limit: pagination.value.limit,
  })
  const page = buildCursorPage({
    rows,
    limit: pagination.value.limit,
    cursorFromRow: row => ({
      id: row.id,
      order: 'desc',
      sort: 'updatedAt' as const,
      sortValue: row.updatedAt.toISOString(),
    }),
    serialize: row => row,
  })
  const previewRows = await listElementPreviewAssets({
    elementIds: page.data.map(element => element.id),
    organizationId: input.organizationId,
    previewRoles: ELEMENT_PREVIEW_ROLES,
  })
  const previews = new Map(await Promise.all(previewRows.map(async asset => [
    asset.elementId,
    await createAssetThumbnailUrl(asset),
  ] as const)))

  return {
    data: page.data.map(element => ({
      ...presentElement(element),
      previewThumbnailUrl: previews.get(element.id) ?? null,
    })),
    nextCursor: page.nextCursor,
  }
}

export async function createElement(input: {
  createdBy: string
  data?: Record<string, unknown>
  instructions?: string
  name: string
  organizationId: string
  type: ElementType
}) {
  if (input.type !== 'other' && input.instructions?.trim()) {
    throw new HttpError(400, 'validation_error', 'Specialized Elements use their Guidelines field.', [{
      code: 'invalid_field',
      field: 'instructions',
      message: 'Use data.description for specialized Element guidelines.',
    }])
  }
  const definition = getElementTypeDefinition(input.type)
  const data = parseData(input.type, input.data ?? {})
  const created = await insertElementWithAssetFolderRow({
    createdBy: input.createdBy,
    data: data as JsonValue,
    id: createId(),
    instructions: input.type === 'other' ? input.instructions || null : null,
    name: input.name,
    organizationId: input.organizationId,
    schemaVersion: definition.currentVersion,
    type: input.type,
  })
  if (created.status !== 'created') {
    throw new HttpError(400, 'validation_error', 'The Element folder could not be created.', [{
      code: created.status === 'limit' ? 'folder_limit' : 'folder_depth',
      field: 'name',
      message: created.status === 'limit'
        ? 'This workspace has reached its folder limit.'
        : 'The workspace Elements folder cannot contain another nested folder.',
    }])
  }
  if (!created.element.assetFolderId)
    throw new Error('A created Element must have an associated Asset folder.')
  return {
    ...presentElement(created.element),
    assetFolderId: created.element.assetFolderId,
  }
}

export async function getElementDetail(organizationId: string, id: string) {
  const element = await findElementById(organizationId, id)
  if (!element)
    throw new TenantResourceNotFoundError()

  const counts = await countElementAssetsByRole(organizationId, id)
  return {
    ...presentElement(element),
    assetCounts: Object.fromEntries(counts.map(row => [row.role, Number(row.count)])),
  }
}

export async function updateElement(input: {
  data?: Record<string, unknown>
  id: string
  instructions?: null | string
  name?: string
  organizationId: string
}) {
  const updated = await updateElementRow({
    id: input.id,
    organizationId: input.organizationId,
    prepare: (element, linkedRoles) => {
      const type = requireStoredElementType(element.type)
      const stored = upcastElementData(type, element.schemaVersion, element.data)
      const data = input.data === undefined
        ? stored.data
        : parseData(type, input.data)

      if (type !== 'other' && input.instructions?.trim()) {
        throw new HttpError(400, 'validation_error', 'Specialized Elements use their Guidelines field.', [{
          code: 'invalid_field',
          field: 'instructions',
          message: 'Use data.description for specialized Element guidelines.',
        }])
      }

      if (type === 'other' && input.data !== undefined) {
        const previousRoles = new Map(
          getElementAssetRoles(type, stored.data)
            .map(role => [role.id, role.accepts[0]]),
        )
        const retainedRoles = new Map(
          getElementAssetRoles(type, data)
            .map(role => [role.id, role.accepts[0]]),
        )
        if (linkedRoles.some(link =>
          !retainedRoles.has(link.role)
          || retainedRoles.get(link.role) !== previousRoles.get(link.role))) {
          throw new HttpError(409, 'invalid_state', 'An Asset role is still in use.', [{
            code: 'invalid_state',
            field: 'data.assetRoles',
            message: 'Unlink Assets from the role before renaming, removing, or changing its media type.',
          }])
        }
      }

      return {
        data: data as JsonValue,
        instructions: type === 'other'
          ? input.instructions === '' ? null : input.instructions
          : null,
        name: input.name,
        schemaVersion: stored.schemaVersion,
      }
    },
  })
  if (!updated)
    throw new TenantResourceNotFoundError()
  return presentElement(updated)
}

export async function deleteElement(organizationId: string, id: string) {
  if (!(await deleteElementRow(organizationId, id)))
    throw new TenantResourceNotFoundError()
}

async function requireElement(organizationId: string, elementId: string) {
  const element = await findElementById(organizationId, elementId)
  if (!element)
    throw new TenantResourceNotFoundError()
  const type = requireStoredElementType(element.type)
  const parsed = upcastElementData(type, element.schemaVersion, element.data)
  return { data: parsed.data, element, type }
}

export async function listElementAssets(input: {
  elementId: string
  organizationId: string
  role?: string
  userId: string
}) {
  const { data, type } = await requireElement(input.organizationId, input.elementId)
  if (input.role)
    requireElementAssetRole(type, input.role, data)

  const rows = await listElementAssetRows(input)
  const assets = await presentAssetsForUser({
    assets: rows,
    organizationId: input.organizationId,
    userId: input.userId,
  })
  return {
    data: rows.map((row, index) => ({
      assetId: row.assetId,
      role: row.role,
      sortOrder: row.sortOrder,
      isPrimary: row.isPrimary,
      asset: assets[index]!,
    })),
    nextCursor: null,
  }
}

export async function attachElementAsset(input: {
  assetId: string
  elementId: string
  isPrimary: boolean
  organizationId: string
  role: string
  sortOrder?: number
  userId: string
}) {
  const result = await createElementAssetLinkRow({
    ...input,
    validateFlowReferenceBudgets: executor => assertElementFlowReferenceBudgets(
      executor,
      {
        elementId: input.elementId,
        organizationId: input.organizationId,
      },
    ),
  })
  if (result.status === 'element_not_found')
    throw new TenantResourceNotFoundError()
  if (result.status === 'asset_not_found')
    throw new TenantResourceNotFoundError('assetId')
  if (result.status === 'asset_not_available') {
    throw new HttpError(409, 'asset_not_available', 'The Asset is not available.', [{
      code: 'asset_not_available',
      field: 'assetId',
      message: 'The Asset is archived or pending deletion.',
    }])
  }
  if (result.status === 'role_not_found')
    throw createElementAssetRoleNotFoundError(input.role)
  if (result.status === 'incompatible_asset') {
    throw createElementAssetMediaTypeNotAcceptedError(
      input.role,
      result.mediaType,
      'assetId',
    )
  }
  if (result.status === 'element_asset_role_capacity_reached')
    throw createElementAssetRoleCapacityError('assetId', result)
  if (result.status === 'conflict') {
    throw new HttpError(409, 'element_asset_already_attached', 'The Asset is already attached.', [{
      code: 'element_asset_already_attached',
      field: 'assetId',
      message: 'The Asset is already attached to this Element role.',
      params: { role: input.role },
    }])
  }

  return getElementAssetLink({ ...input, role: input.role })
}

async function getElementAssetLink(input: {
  assetId: string
  elementId: string
  organizationId: string
  role: string
  userId: string
}) {
  const list = await listElementAssets({
    elementId: input.elementId,
    organizationId: input.organizationId,
    role: input.role,
    userId: input.userId,
  })
  const link = list.data.find(item => item.assetId === input.assetId)
  if (!link)
    throw new TenantResourceNotFoundError()
  return link
}

export async function updateElementAsset(input: {
  assetId: string
  elementId: string
  isPrimary?: boolean
  organizationId: string
  role: string
  sortOrder?: number
  userId: string
}) {
  const { data, type } = await requireElement(input.organizationId, input.elementId)
  requireElementAssetRole(type, input.role, data)
  const result = await updateElementAssetLinkRow(input)
  if (result.status !== 'updated')
    throw new TenantResourceNotFoundError()
  return getElementAssetLink(input)
}

export async function unlinkElementAsset(input: {
  assetId: string
  elementId: string
  organizationId: string
  role: string
}) {
  const { data, type } = await requireElement(input.organizationId, input.elementId)
  requireElementAssetRole(type, input.role, data)
  if (!(await deleteElementAssetLinkRow(input)))
    throw new TenantResourceNotFoundError()
}

export async function getElementUsage(organizationId: string, elementId: string) {
  await requireElement(organizationId, elementId)
  const usage = await getElementUsageRows(organizationId, elementId)
  return {
    flowCount: Number(usage.flowSummary.count),
    flows: usage.flows.map(flow => ({
      flowId: flow.flowId,
      flowName: flow.flowName,
      nodeCount: Number(flow.nodeCount),
    })),
    runCount: Number(usage.runSummary.count),
    lastUsedAt: usage.runSummary.lastUsedAt?.toISOString() ?? null,
  }
}
