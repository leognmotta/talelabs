import type { OtherElementData } from '@talelabs/elements'

import {
  ElementIdentitySchema,
  getElementAssetRole,
  getElementAssetRoles,
  isElementType,
  upcastElementData,
} from '@talelabs/elements'

import {
  findElementById,
  listUsableElementContextAssetRows,
} from '../../data/elements.data.js'
import { TenantResourceNotFoundError } from '../../middleware/error.js'
import { addElementIdentityGuidance } from './add-context-section.js'
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
  const elementType = element.type

  const parsed = upcastElementData(elementType, element.schemaVersion, element.data)
  const roleOrder = new Map<string, number>(
    getElementAssetRoles(elementType, parsed.data)
      .map((role, index) => [role.id, index]),
  )
  const rows = await listUsableElementContextAssetRows(input)
  const assets = rows
    .flatMap((row) => {
      if (row.mediaType === 'document')
        return []
      const mediaType = row.mediaType
      const role = getElementAssetRole(elementType, row.role, parsed.data)
      const metadata = role?.referenceMetadataSchema.safeParse(
        row.referenceMetadata,
      )
      if (!metadata?.success)
        return []
      return [{
        ...row,
        mediaType,
        referenceMetadata: metadata.data,
      }]
    })
    .toSorted((left, right) =>
      Number(right.isPrimary) - Number(left.isPrimary)
      || (roleOrder.get(left.role) ?? Number.MAX_SAFE_INTEGER)
      - (roleOrder.get(right.role) ?? Number.MAX_SAFE_INTEGER)
      || left.sortOrder - right.sortOrder
      || left.assetId.localeCompare(right.assetId))
    .map(row => ({
      assetId: row.assetId,
      isPrimary: row.isPrimary,
      mediaType: row.mediaType,
      mimeType: row.mimeType,
      referenceMetadata: row.referenceMetadata,
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
  const context = elementType === 'other'
    ? buildOtherContext({
        ...contextInput,
        data: parsed.data as OtherElementData,
        instructions: element.instructions,
      })
    : getElementContextBuilder(elementType)(contextInput)
  const sections = [context.text]
  addElementIdentityGuidance(
    sections,
    ElementIdentitySchema.parse(parsed.data.identity),
  )
  return { ...context, text: sections.filter(Boolean).join('\n') }
}
