/**
 * Bounded Project Brief document validation and plain-text projection.
 *
 * Project mentions are navigational atoms and deliberately remain separate
 * from generation prompt-reference nodes.
 */

import type { JsonObject, JsonValue } from '@talelabs/db'

import { Buffer } from 'node:buffer'
import { isCuid } from '@paralleldrive/cuid2'

/** Entity families that a Project Brief may reference. */
export const PROJECT_MENTION_TYPES = [
  'asset',
  'element',
  'flow',
  'folder',
  'session',
] as const

/** Entity family carried by one structured Brief mention. */
export type ProjectMentionType = typeof PROJECT_MENTION_TYPES[number]

/** Stable Project entity identity embedded in a Brief mention node. */
export interface ProjectMention {
  /** Stable entity identifier, independent from presentation. */
  entityId: string
  /** Domain used for validation and navigation. */
  entityType: ProjectMentionType
  /** Readable label retained while current metadata is unavailable. */
  fallbackLabel: string
}

/** Result of validating one authoritative Tiptap JSON document. */
export interface ValidProjectBriefDocument {
  /** Bounded JSON safe to persist as the editable source of truth. */
  document: JsonObject
  /** Unique structured references collected from the document. */
  mentions: ProjectMention[]
  /** Server-derived searchable text projection. */
  plainText: string
}

const MAX_DOCUMENT_BYTES = 262_144
const MAX_DEPTH = 32
const MAX_MENTIONS = 200
const MAX_NODES = 2_000
const MAX_TEXT_LENGTH = 100_000
const BLOCK_NODES = new Set([
  'blockquote',
  'bulletList',
  'heading',
  'horizontalRule',
  'orderedList',
  'paragraph',
  'taskList',
])
const INLINE_NODES = new Set([
  'hardBreak',
  'projectEntityMention',
  'text',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function assertOnlyKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
) {
  const allowed = new Set(keys)
  if (Object.keys(value).some(key => !allowed.has(key)))
    throw new Error('project_brief_unsupported_property')
}

function validateLinkHref(value: unknown) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 2_048)
    throw new Error('project_brief_invalid_link')
  try {
    const protocol = new URL(value, 'https://talelabs.local').protocol
    if (!['http:', 'https:', 'mailto:'].includes(protocol))
      throw new Error('project_brief_invalid_link')
  }
  catch {
    throw new Error('project_brief_invalid_link')
  }
}

function validateMarks(value: unknown) {
  if (value === undefined)
    return
  if (!Array.isArray(value) || value.length > 16)
    throw new Error('project_brief_invalid_marks')
  for (const mark of value) {
    if (!isRecord(mark) || typeof mark.type !== 'string')
      throw new Error('project_brief_invalid_mark')
    if (mark.type === 'bold' || mark.type === 'italic') {
      assertOnlyKeys(mark, ['type'])
      continue
    }
    if (mark.type !== 'link' || !isRecord(mark.attrs))
      throw new Error('project_brief_unsupported_mark')
    assertOnlyKeys(mark, ['attrs', 'type'])
    assertOnlyKeys(mark.attrs, ['class', 'href', 'rel', 'target'])
    validateLinkHref(mark.attrs.href)
    for (const key of ['class', 'rel', 'target'] as const) {
      const attribute = mark.attrs[key]
      if (attribute !== undefined && attribute !== null && typeof attribute !== 'string')
        throw new Error('project_brief_invalid_link_attribute')
    }
  }
}

function validateMention(value: Record<string, unknown>): ProjectMention {
  if (!isRecord(value.attrs))
    throw new Error('project_brief_invalid_mention')
  assertOnlyKeys(value, ['attrs', 'type'])
  assertOnlyKeys(value.attrs, ['entityId', 'entityType', 'fallbackLabel'])
  const { entityId, entityType, fallbackLabel } = value.attrs
  if (
    typeof entityId !== 'string'
    || !isCuid(entityId)
    || typeof entityType !== 'string'
    || !PROJECT_MENTION_TYPES.includes(entityType as ProjectMentionType)
    || typeof fallbackLabel !== 'string'
    || fallbackLabel.trim().length < 1
    || fallbackLabel.length > 120
  ) {
    throw new Error('project_brief_invalid_mention')
  }
  return {
    entityId,
    entityType: entityType as ProjectMentionType,
    fallbackLabel,
  }
}

function validateAttrs(type: string, attrs: unknown) {
  if (type === 'heading') {
    if (
      !isRecord(attrs)
      || !Number.isInteger(attrs.level)
      || Number(attrs.level) < 1
      || Number(attrs.level) > 4
    ) {
      throw new Error('project_brief_invalid_heading')
    }
    assertOnlyKeys(attrs, ['level'])
    return
  }
  if (type === 'orderedList') {
    if (attrs === undefined)
      return
    if (
      !isRecord(attrs)
      || !Number.isInteger(attrs.start)
      || Number(attrs.start) < 1
      || (
        attrs.type !== undefined
        && attrs.type !== null
        && !['1', 'a', 'A', 'i', 'I'].includes(String(attrs.type))
      )
    ) {
      throw new Error('project_brief_invalid_ordered_list')
    }
    assertOnlyKeys(attrs, ['start', 'type'])
    return
  }
  if (type === 'taskItem') {
    if (!isRecord(attrs) || typeof attrs.checked !== 'boolean')
      throw new Error('project_brief_invalid_task_item')
    assertOnlyKeys(attrs, ['checked'])
    return
  }
  if (attrs !== undefined)
    throw new Error('project_brief_unsupported_attrs')
}

function assertChildType(parentType: string, childType: string) {
  if (parentType === 'doc' || parentType === 'blockquote') {
    if (!BLOCK_NODES.has(childType))
      throw new Error('project_brief_invalid_block_child')
    return
  }
  if (parentType === 'bulletList' || parentType === 'orderedList') {
    if (childType !== 'listItem')
      throw new Error('project_brief_invalid_list_child')
    return
  }
  if (parentType === 'taskList') {
    if (childType !== 'taskItem')
      throw new Error('project_brief_invalid_task_list_child')
    return
  }
  if (parentType === 'listItem' || parentType === 'taskItem') {
    if (!BLOCK_NODES.has(childType))
      throw new Error('project_brief_invalid_item_child')
    return
  }
  if (!INLINE_NODES.has(childType))
    throw new Error('project_brief_invalid_inline_child')
}

/** Validates the bounded Brief schema and derives mentions plus plain text. */
export function validateProjectBriefDocument(
  value: unknown,
): ValidProjectBriefDocument {
  const serialized = JSON.stringify(value)
  if (Buffer.byteLength(serialized, 'utf8') > MAX_DOCUMENT_BYTES)
    throw new Error('project_brief_document_too_large')

  let nodeCount = 0
  let textLength = 0
  const mentions = new Map<string, ProjectMention>()
  const textParts: string[] = []

  function visit(node: unknown, depth: number, parentType?: string) {
    if (!isRecord(node) || typeof node.type !== 'string')
      throw new Error('project_brief_invalid_node')
    if (depth > MAX_DEPTH || ++nodeCount > MAX_NODES)
      throw new Error('project_brief_document_too_complex')
    if (parentType)
      assertChildType(parentType, node.type)

    if (node.type === 'text') {
      assertOnlyKeys(node, ['marks', 'text', 'type'])
      if (typeof node.text !== 'string')
        throw new Error('project_brief_invalid_text')
      validateMarks(node.marks)
      textLength += node.text.length
      textParts.push(node.text)
      return
    }
    if (node.type === 'projectEntityMention') {
      const mention = validateMention(node)
      mentions.set(`${mention.entityType}:${mention.entityId}`, mention)
      textParts.push(`@${mention.fallbackLabel}`)
      return
    }
    if (node.type === 'hardBreak') {
      assertOnlyKeys(node, ['type'])
      textParts.push('\n')
      return
    }
    if (node.type === 'horizontalRule') {
      assertOnlyKeys(node, ['type'])
      textParts.push('\n')
      return
    }
    const containerTypes = new Set([
      'blockquote',
      'bulletList',
      'doc',
      'heading',
      'listItem',
      'orderedList',
      'paragraph',
      'taskItem',
      'taskList',
    ])
    if (!containerTypes.has(node.type))
      throw new Error('project_brief_unsupported_node')
    assertOnlyKeys(node, ['attrs', 'content', 'type'])
    validateAttrs(node.type, node.attrs)
    if (node.content !== undefined && !Array.isArray(node.content))
      throw new Error('project_brief_invalid_content')
    for (const child of node.content ?? [])
      visit(child, depth + 1, node.type)
    if (node.type !== 'doc')
      textParts.push('\n')
  }

  visit(value, 1)
  if (!isRecord(value) || value.type !== 'doc')
    throw new Error('project_brief_root_required')
  if (textLength > MAX_TEXT_LENGTH || mentions.size > MAX_MENTIONS)
    throw new Error('project_brief_document_too_complex')

  return {
    document: JSON.parse(serialized) as JsonObject,
    mentions: [...mentions.values()],
    plainText: textParts.join('')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .slice(0, MAX_TEXT_LENGTH),
  }
}

/** Narrows a validated document for database JSON writes. */
export function projectBriefDocumentAsJson(
  document: JsonObject,
): JsonValue {
  return document
}
