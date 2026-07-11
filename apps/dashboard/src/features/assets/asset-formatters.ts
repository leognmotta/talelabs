import type { Asset, Folder } from '@talelabs/sdk'

export function formatAssetSize(bytes: number | null, locale: string) {
  if (bytes === null)
    return null

  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'] as const
  let value = bytes
  let unit = 0

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }

  return `${new Intl.NumberFormat(locale, {
    maximumFractionDigits: value >= 10 || unit === 0 ? 0 : 1,
  }).format(value)} ${units[unit]}`
}

export function formatDuration(seconds: number | null) {
  if (seconds === null)
    return null
  const minutes = Math.floor(seconds / 60)
  const remainder = Math.round(seconds % 60)
  return `${minutes}:${remainder.toString().padStart(2, '0')}`
}

export function getFolderPath(folders: Folder[], folderId: null | string) {
  if (!folderId)
    return []

  const byId = new Map(folders.map(folder => [folder.id, folder]))
  const path: Folder[] = []
  const seen = new Set<string>()
  let current = byId.get(folderId)

  while (current && !seen.has(current.id)) {
    path.unshift(current)
    seen.add(current.id)
    current = current.parentId ? byId.get(current.parentId) : undefined
  }

  return path
}

export function canPreviewAsset(asset: Asset) {
  return asset.processingState === 'ready' && Boolean(asset.url)
}
