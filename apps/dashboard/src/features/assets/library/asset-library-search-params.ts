/** Typed nuqs schema for every shareable Asset library control. */

import type {
  AssetGeneratedByFilter,
  AssetLibraryView,
} from './asset-library.types'
import {
  createParser,
  parseAsBoolean,
  parseAsString,
  parseAsStringLiteral,
} from 'nuqs'
import { parseAsCuid2 } from '../../../shared/lib/search-param-parsers'

const assetTypes = ['image', 'video', 'audio', 'document'] as const
const assetSources = ['upload', 'generation'] as const
const assetSorts = ['createdAt', 'name', 'sizeBytes'] as const
const sortOrders = ['asc', 'desc'] as const
const assetLibraryViews = ['grid', 'list'] as const
const cuid2Pattern = /^[a-z][0-9a-z]{1,31}$/
const folderScopeParser = createParser({
  parse: value => value === 'root' || cuid2Pattern.test(value) ? value : null,
  serialize: value => value,
})
const projectScopeParser = createParser({
  parse: value => value === 'private' || cuid2Pattern.test(value)
    ? value
    : null,
  serialize: value => value,
})
const generatedByParser = createParser<AssetGeneratedByFilter>({
  parse: (value) => {
    const [kind, id, extra] = value.split(':')
    if (extra || !id || !cuid2Pattern.test(id))
      return null
    if (kind === 'flow')
      return { id, kind }
    if (kind === 'session')
      return { id, kind: 'createSession' }
    return null
  },
  serialize: value => `${
    value.kind === 'createSession' ? 'session' : 'flow'
  }:${value.id}`,
})
/** Defines typed URL parsers and defaults for every shareable library control. */
export function createAssetLibrarySearchParams(defaultView: AssetLibraryView) {
  return {
    archived: parseAsBoolean.withDefault(false),
    favorite: parseAsBoolean.withDefault(false),
    folderId: folderScopeParser,
    generatedBy: generatedByParser,
    order: parseAsStringLiteral(sortOrders).withDefault('desc'),
    projectId: projectScopeParser,
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
  generatedBy: 'generatedBy',
  order: 'order',
  projectId: 'project',
  search: 'q',
  sort: 'sort',
  source: 'source',
  tagId: 'tag',
  type: 'type',
  view: 'view',
} as const
