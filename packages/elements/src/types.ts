import type { z } from 'zod'
import type {
  ElementReadinessDefinition,
  ElementReferenceMetadata,
} from './consistency.js'

/**
 * Stable identifiers for Element behaviors supported by the product.
 *
 * An Element type selects its versioned data schemas, Asset roles, dedicated
 * dashboard form, and server-side context builder. These values are persisted,
 * so renaming or removing one requires an explicit data migration and
 * compatibility plan. React and API implementations live outside this package.
 */
export type ElementType
  = | 'brand'
    | 'character'
    | 'location'
    | 'object'
    | 'other'
    | 'product'
    | 'vehicle'
    | 'voice'

/**
 * Asset media families that an Element role may use.
 *
 * This is intentionally narrower than MIME types. MIME-level validation is
 * performed against the canonical Asset after matching the role's family.
 */
export type ElementAssetMediaType = 'audio' | 'image' | 'video'

/** Migrates one validated stored representation to exactly the next version. */
export type ElementDataMigration = (data: unknown) => unknown

/**
 * Defines one semantic slot in an Element's reusable Asset kit.
 *
 * Roles describe why an Asset belongs to an Element, such as a character's
 * `appearance` or a product's `packshot`. Role IDs are persisted on Element ↔
 * Asset links and therefore form part of the durable data contract.
 *
 * @typeParam Role - Literal union of role IDs supported by an Element type.
 */
export interface ElementAssetRoleDefinition<Role extends string = string> {
  /** The single accepted media family for this role. */
  accepts: readonly [ElementAssetMediaType]

  /**
   * Stable role identifier persisted on Element ↔ Asset links.
   *
   * Renaming or removing an ID requires migrating or deprecating existing
   * links; changing only localized display copy does not.
   */
  id: Role

  /** Maximum number of linked Assets retained as Element context. */
  maxAssets: number

  /** Whether the role may contain more than one linked Asset. */
  multiple: boolean

  /** Strict registry-owned schema for relationship-specific metadata. */
  referenceMetadataSchema: z.ZodType<ElementReferenceMetadata>
}

/** Product policy for user-named Asset roles stored in Element data. */
export interface ElementCustomAssetRolesDefinition {
  /** Media families a user may choose when defining a custom role. */
  allowedMediaTypes: readonly ElementAssetMediaType[]

  /** Maximum number of custom roles one Element may define. */
  maxRoles: number

}

/** User-defined role metadata persisted in Element data. */
export interface ElementCustomAssetRole {
  /** Stable user-defined role identifier persisted on Element ↔ Asset links. */
  id: string

  /** The single media family accepted by this role. */
  mediaType: ElementAssetMediaType
}

/**
 * Complete framework-neutral contract for one Element type.
 *
 * Definitions are product-controlled runtime configuration shared by the API
 * and dashboard. They describe persisted data, schema evolution, and Asset-kit
 * semantics only. Dedicated React forms and server-only context builders live
 * in separate registries so neither leaks across runtime boundaries.
 *
 * @typeParam Type - Stable persisted Element type identifier.
 */
export interface ElementTypeDefinition<
  Type extends ElementType = ElementType,
> {
  /** Ordered semantic roles available in this Element type's Asset kit. */
  assetRoles: readonly ElementAssetRoleDefinition[]

  /** Optional policy for roles named by the user and stored in `data.assetRoles`. */
  customAssetRoles?: ElementCustomAssetRolesDefinition

  /**
   * Latest schema version written by creates and updates.
   *
   * Reads may accept older stored versions and sequentially upcast them in
   * memory. The stored row is rewritten only by an explicit successful write.
   */
  currentVersion: number

  /** Stable persisted Element type identifier and registry key. */
  id: Type

  /**
   * Asset role preferred when selecting a representative Element thumbnail.
   * The value must reference one of `assetRoles`.
   */
  previewRole: null | string

  /** Deterministic, framework-neutral rules for derived consistency readiness. */
  readiness: ElementReadinessDefinition

  /**
   * Explicit Zod schemas for every supported stored representation, keyed by
   * schema version. The current entry validates writes and migrated reads.
   */
  schemas: Readonly<Record<number, z.ZodType>>

  /**
   * Sequential migrations for persisted Element data.
   *
   * Each key is the source schema version and its function migrates data to
   * the next version. For example, key `1` migrates v1 data to v2. Reading a
   * v1 Element whose current version is v3 applies `migrations[1]` and then
   * `migrations[2]` before validating the result with the current schema.
   *
   * Definitions must provide every required intermediate migration. A
   * missing version is a migration gap and must fail rather than skip data
   * transformations or guess the stored shape.
   */
  migrations: Readonly<Partial<Record<number, ElementDataMigration>>>
}

/**
 * Current, validated Element data returned after parsing and upcasting.
 *
 * Consumers should use this result instead of reading unvalidated database
 * JSON directly. `schemaVersion` describes the returned representation, which
 * is normally the type definition's current version after upcasting.
 *
 * @typeParam Type - Stable Element type associated with the parsed payload.
 * @typeParam Data - Validated current data shape for that type.
 */
export interface ParsedElementData<
  Type extends ElementType = ElementType,
  Data extends Record<string, unknown> = Record<string, unknown>,
> {
  /** Validated and fully upcast Element data. */
  data: Data

  /** Schema version represented by `data` after parsing and migration. */
  schemaVersion: number

  /** Element type whose registry definition parsed the payload. */
  type: Type
}
