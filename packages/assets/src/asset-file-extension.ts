import type { AssetUploadMimeType } from './index.js'

const ASSET_FILE_EXTENSIONS = {
  'audio/aac': ['aac'],
  'audio/flac': ['flac'],
  'audio/m4a': ['m4a'],
  'audio/mp4': ['m4a', 'mp4'],
  'audio/mpeg': ['mp3', 'mpeg'],
  'audio/ogg': ['ogg'],
  'audio/wav': ['wav'],
  'audio/x-wav': ['wav'],
  'image/avif': ['avif'],
  'image/gif': ['gif'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
  'video/mp4': ['mp4'],
  'video/quicktime': ['mov', 'qt'],
  'video/webm': ['webm'],
} as const satisfies Record<AssetUploadMimeType, readonly string[]>

export function ensureAssetFileExtension(name: string, mimeType: string) {
  const normalizedMimeType = mimeType
    .split(';')[0]
    ?.trim()
    .toLowerCase() as AssetUploadMimeType
  const extensions = ASSET_FILE_EXTENSIONS[normalizedMimeType] as
    | readonly string[]
    | undefined
  if (!extensions?.length)
    return name

  const normalizedName = name.toLowerCase()
  return extensions.some(extension => normalizedName.endsWith(`.${extension}`))
    ? name
    : `${name}.${extensions[0]}`
}
