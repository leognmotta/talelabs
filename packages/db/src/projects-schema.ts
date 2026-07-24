/** Kysely contracts owned by the optional Project organization layer. */

import type { Generated } from 'kysely'
import type {
  GeneratedBigIntColumn,
  GeneratedJsonColumn,
  GeneratedTimestamp,
  NullableTimestamp,
} from './column-types.js'

/** Organization-scoped Project identity and optional Asset defaults. */
export interface ProjectTable {
  /** Stable Project route identity. */
  id: string
  /** Tenant that owns the Project and every assigned entity. */
  organizationId: string
  /** User who created the Project, retained only for attribution. */
  createdBy: string | null
  /** Primary user-facing Project label. */
  name: string
  /** Optional short Project summary used in lists and search. */
  description: Generated<string>
  /** Project-owned Asset used as a visual cover, when configured. */
  coverAssetId: Generated<string | null>
  /** Project-owned folder used before falling back to the Project root. */
  defaultAssetFolderId: Generated<string | null>
  /** Initial Project creation instant. */
  createdAt: GeneratedTimestamp
  /** Latest metadata or owned-entity update instant. */
  updatedAt: GeneratedTimestamp
  /** Soft-archive instant; null keeps the Project active. */
  archivedAt: NullableTimestamp
}

/** One authoritative structured Brief document per Project. */
export interface ProjectBriefTable {
  /** Project identity and one-to-one Brief primary key. */
  projectId: string
  /** Tenant duplicated for composite tenancy constraints and scoped reads. */
  organizationId: string
  /** Authoritative bounded Tiptap JSON document. */
  document: GeneratedJsonColumn
  /** Monotonic compare-and-set revision used by autosave. */
  revision: GeneratedBigIntColumn
  /** Server-derived searchable text; never an editable source. */
  plainText: Generated<string>
  /** User that most recently saved the Brief. */
  updatedBy: string | null
  /** Database-authored latest successful save instant. */
  updatedAt: GeneratedTimestamp
}
