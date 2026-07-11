import type { OtherElementData } from '@talelabs/elements'

import {
  getElementAssetRoles,
  isElementType,
  upcastElementData,
} from '@talelabs/elements'

import {
  findElementById,
  listUsableElementContextAssetRows,
} from '../../data/elements.data.js'
import { TenantResourceNotFoundError } from '../../middleware/error.js'
import { buildOtherContext } from './build-other-context.js'
import { getElementContextBuilder } from './element-context-builders.js'

export async function buildElementContext(input: {
  elementId: string
  organizationId: string
}) {
  const element = await findElementById(input.organizationId, input.elementId)
  if (!element)
    throw new TenantResourceNotFoundError()
  if (!isElementType(element.type))
    throw new Error(`Stored Element type is not registered: ${element.type}`)

  const parsed = upcastElementData(element.type, element.schemaVersion, element.data)
  const roleOrder = new Map<string, number>(
    getElementAssetRoles(element.type, parsed.data)
      .map((role, index) => [role.id, index]),
  )
  const rows = await listUsableElementContextAssetRows(input)
  const assets = rows
    .filter((row): row is typeof row & { mediaType: 'audio' | 'image' | 'video' } =>
      row.mediaType !== 'document')
    .toSorted((left, right) =>
      (roleOrder.get(left.role) ?? Number.MAX_SAFE_INTEGER)
      - (roleOrder.get(right.role) ?? Number.MAX_SAFE_INTEGER)
      || left.sortOrder - right.sortOrder
      || left.assetId.localeCompare(right.assetId))
    .map(row => ({
      assetId: row.assetId,
      isPrimary: row.isPrimary,
      mediaType: row.mediaType,
      mimeType: row.mimeType,
      role: row.role,
      sortOrder: row.sortOrder,
    }))

  const contextInput = {
    assets,
    data: parsed.data,
    elementId: element.id,
    name: element.name,
    schemaVersion: parsed.schemaVersion,
  }
  return element.type === 'other'
    ? buildOtherContext({
        ...contextInput,
        data: parsed.data as OtherElementData,
        instructions: element.instructions,
      })
    : getElementContextBuilder(element.type)(contextInput)
}
