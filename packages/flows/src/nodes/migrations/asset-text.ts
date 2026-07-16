import {
  EmptyNodeDataSchema,
  LockedNodeDataSchema,
  TextNodeDataSchemaV1,
} from '../data/schemas.js'
import { addLockedState } from './index.js'

export function migrateAssetNodeDataV1(data: unknown) {
  return addLockedState(EmptyNodeDataSchema.parse(data))
}

export function migrateAssetNodeDataV2(data: unknown) {
  return LockedNodeDataSchema.parse(data)
}

export function migrateTextNodeDataV1(data: unknown) {
  return addLockedState(TextNodeDataSchemaV1.parse(data))
}
