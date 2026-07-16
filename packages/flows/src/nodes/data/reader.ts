import type { ParsedFlowNodeData } from '../../graph/types.js'

import { migrateLegacyAudioGenerationNode } from '../migrations/legacy-audio.js'
import {
  getFlowNodeTypeDefinition,
  isFlowNodeType,
} from '../registry/types.js'

export function parseAndUpcastFlowNodeData(input: {
  data: unknown
  schemaVersion: number
  type: string
}): ParsedFlowNodeData {
  if (!isFlowNodeType(input.type))
    throw new Error(`Unknown Flow node type: ${input.type}`)

  const definition = getFlowNodeTypeDefinition(input.type)
  if (
    !Number.isInteger(input.schemaVersion)
    || input.schemaVersion < 1
    || input.schemaVersion > definition.currentVersion
  ) {
    throw new Error(
      `Unsupported ${input.type} node schema version: ${input.schemaVersion}`,
    )
  }

  let version = input.schemaVersion
  let data = definition.schemas[version]?.parse(input.data)
  if (data === undefined)
    throw new Error(`Missing ${input.type} node schema version: ${version}`)

  while (version < definition.currentVersion) {
    const migration = definition.migrations[version]
    if (!migration) {
      throw new Error(
        `Missing ${input.type} node migration: ${version} -> ${version + 1}`,
      )
    }
    data = migration(data)
    version += 1
    const schema = definition.schemas[version]
    if (!schema)
      throw new Error(`Missing ${input.type} node schema version: ${version}`)
    data = schema.parse(data)
  }

  return migrateLegacyAudioGenerationNode({
    data: data as Record<string, unknown>,
    schemaVersion: definition.currentVersion,
    type: input.type,
  })
}
