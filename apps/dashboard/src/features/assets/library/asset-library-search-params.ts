/** Typed nuqs schema for every shareable Asset library control. */

import type { AssetLibraryView } from './asset-library.types'
import { parseAsBoolean, parseAsString, parseAsStringLiteral } from 'nuqs'
import { parseAsCuid2 } from '../../../shared/lib/search-param-parsers'

const assetTypes = ['image', 'video', 'audio', 'document'] as const
const assetSources = ['upload', 'generation'] as const
const assetSorts = ['createdAt', 'name', 'sizeBytes'] as const
const sortOrders = ['asc', 'desc'] as const
const assetLibraryViews = ['grid', 'list'] as const
/** Defines typed URL parsers and defaults for every shareable library control. */
export function createAssetLibrarySearchParams(defaultView: AssetLibraryView) {
  return {
    archived: parseAsBoolean.withDefault(false),
    favorite: parseAsBoolean.withDefault(false),
    folderId: parseAsCuid2,
    order: parseAsStringLiteral(sortOrders).withDefault('desc'),
    search: parseAsString.withDefault(''),
    sort: parseAsStringLiteral(assetSorts).withDefault('createdAt'),
    source: parseAsStringLiteral(assetSources),
    tagId: parseAsCuid2,
    type: parseAsStringLiteral(assetTypes),
    view: parseAsStringLiteral(assetLibraryViews)
      .withDefault(defaultView)
      .withOptions({ clearOnDefault: false }),
  }
}

/** URL keys reserved for Asset library state so embedded consumers can omit them. */
export const assetLibraryUrlKeys = {
  archived: 'archived',
  favorite: 'favorite',
  folderId: 'folder',
  order: 'order',
  search: 'q',
  sort: 'sort',
  source: 'source',
  tagId: 'tag',
  type: 'type',
  view: 'view',
} as const
