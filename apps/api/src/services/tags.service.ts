import { createId } from '@paralleldrive/cuid2'

import {
  createTagRow,
  deleteTagRow,
  listTagRows,
} from '../data/tags.data.js'
import { TenantResourceNotFoundError } from '../middleware/error.js'

function presentTag(tag: {
  createdAt: Date
  id: string
  name: string
  updatedAt: Date
}) {
  return {
    createdAt: tag.createdAt.toISOString(),
    id: tag.id,
    name: tag.name,
    updatedAt: tag.updatedAt.toISOString(),
  }
}

function normalizeTagName(name: string) {
  const displayName = name.normalize('NFKC').replace(/\s+/g, ' ').trim()
  return {
    displayName,
    normalizedName: displayName.toLocaleLowerCase('en-US'),
  }
}

export async function listTags(organizationId: string) {
  const tags = await listTagRows(organizationId)
  return { data: tags.map(presentTag) }
}

export async function createTag(input: {
  name: string
  organizationId: string
  userId: string
}) {
  const name = normalizeTagName(input.name)
  const tag = await createTagRow({
    id: createId(),
    name: name.displayName,
    normalizedName: name.normalizedName,
    organizationId: input.organizationId,
    userId: input.userId,
  })

  return presentTag(tag)
}

export async function deleteTag(organizationId: string, id: string) {
  if (!(await deleteTagRow(organizationId, id)))
    throw new TenantResourceNotFoundError()
}
