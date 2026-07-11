import type {
  ElementAssetRoleDefinition,
} from '@talelabs/elements'

export function getElementAssetMediaType(value: string) {
  const mediaType = value.includes('/') ? value.split('/')[0] : value
  return mediaType === 'audio' || mediaType === 'image' || mediaType === 'video'
    ? mediaType
    : null
}

export function formatRejectedElementAssetFiles(files: File[]) {
  return files.map(file => file.name).join(', ')
}

export function elementAssetRoleHasCapacity(
  existingCount: number,
  role: ElementAssetRoleDefinition,
) {
  return existingCount < role.maxAssets
}

export function selectElementAssetFilesWithinRoleLimit(
  files: File[],
  existingCount: number,
  role: ElementAssetRoleDefinition,
) {
  let count = existingCount
  const accepted: File[] = []
  const rejected: File[] = []
  for (const file of files) {
    const mediaType = getElementAssetMediaType(file.type)
    if (
      !mediaType
      || !role.accepts.includes(mediaType)
      || count >= role.maxAssets
    ) {
      rejected.push(file)
      continue
    }

    count += 1
    accepted.push(file)
  }
  return { accepted, rejected }
}
