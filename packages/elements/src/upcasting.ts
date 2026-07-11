import type { ElementDataMigration, ElementType, ParsedElementData } from './types.js'
import { getElementTypeDefinition } from './registry.js'

export function upcastElementData<Type extends ElementType>(
  type: Type,
  schemaVersion: number,
  input: unknown,
): ParsedElementData<Type> {
  const definition = getElementTypeDefinition(type)

  if (!Number.isInteger(schemaVersion) || schemaVersion < 1)
    throw new Error(`Element ${type} has an invalid schema version: ${schemaVersion}`)
  if (schemaVersion > definition.currentVersion) {
    throw new Error(
      `Element ${type} schema version ${schemaVersion} is newer than supported version ${definition.currentVersion}`,
    )
  }

  const schemas = definition.schemas as Readonly<Record<number, import('zod').ZodType>>
  const storedSchema = schemas[schemaVersion]
  if (!storedSchema)
    throw new Error(`Element ${type} has no schema for version ${schemaVersion}`)

  let data: unknown = input ?? {}
  let version = schemaVersion
  while (version < definition.currentVersion) {
    const sourceSchema = schemas[version]
    if (!sourceSchema)
      throw new Error(`Element ${type} has no schema for version ${version}`)
    data = sourceSchema.parse(data)

    const migration = (definition.migrations as Readonly<
      Partial<Record<number, ElementDataMigration>>
    >)[version]
    if (!migration) {
      throw new Error(
        `Element ${type} has no migration from schema version ${version} to ${version + 1}`,
      )
    }
    data = migration(data)
    version += 1
  }

  const currentSchema = schemas[definition.currentVersion]
  if (!currentSchema) {
    throw new Error(
      `Element ${type} has no current schema for version ${definition.currentVersion}`,
    )
  }
  data = currentSchema.parse(data)

  return {
    data,
    schemaVersion: definition.currentVersion,
    type,
  } as ParsedElementData<Type>
}

export function parseElementData<Type extends ElementType>(
  type: Type,
  input: unknown,
  schemaVersion = getElementTypeDefinition(type).currentVersion,
) {
  return upcastElementData(type, schemaVersion, input).data
}
