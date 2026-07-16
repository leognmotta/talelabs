import type {
  FlowGraphNode,
  FlowNodeTypeDefinition,
} from '../../graph/types.js'

import { getDefaultNodeData } from '../data/defaults.js'
import { parseAndUpcastFlowNodeData } from '../data/reader.js'
import {
  FLOW_NODE_TYPE_REGISTRY,
  getFlowNodeTypeDefinition,
  isFlowNodeType,
  SELECTABLE_FLOW_NODE_TYPES,
} from './types.js'

export function validateDefaultFlowNodeData() {
  const errors: string[] = []

  for (const type of SELECTABLE_FLOW_NODE_TYPES) {
    const definition = getFlowNodeTypeDefinition(type)
    try {
      parseAndUpcastFlowNodeData({
        data: getDefaultNodeData(type),
        schemaVersion: definition.currentVersion,
        type,
      })
    }
    catch {
      errors.push(`${type}: default node data must parse its current schema`)
    }
  }

  return errors
}

export function validateFlowNodeRegistry(
  registry: Record<string, FlowNodeTypeDefinition> = FLOW_NODE_TYPE_REGISTRY,
) {
  const errors: string[] = []

  for (const [key, definition] of Object.entries(registry)) {
    if (definition.id !== key)
      errors.push(`${key}: definition id must match its registry key`)
    if (
      !Number.isInteger(definition.currentVersion)
      || definition.currentVersion < 1
    ) {
      errors.push(`${key}: currentVersion must be a positive integer`)
    }

    for (let version = 1; version <= definition.currentVersion; version += 1) {
      if (!definition.schemas[version])
        errors.push(`${key}: missing schema version ${version}`)
      if (
        version < definition.currentVersion
        && !definition.migrations[version]
      ) {
        errors.push(`${key}: missing migration ${version} -> ${version + 1}`)
      }
    }

    const handles = definition.staticHandles
    const handleKeys = handles.map(
      handle => `${handle.direction}:${handle.id}`,
    )
    if (new Set(handleKeys).size !== handleKeys.length)
      errors.push(`${key}: static handle ids must be unique per direction`)
  }

  if (registry === FLOW_NODE_TYPE_REGISTRY)
    errors.push(...validateDefaultFlowNodeData())

  return errors
}

export function validateNodeReferences(node: FlowGraphNode) {
  if (!isFlowNodeType(node.type))
    return false
  const reference = getFlowNodeTypeDefinition(node.type).reference
  if (reference === 'asset')
    return true
  return node.assetId === null
}
