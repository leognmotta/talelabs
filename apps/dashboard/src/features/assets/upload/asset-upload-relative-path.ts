/** Safe relative-path normalization for browser directory uploads. */

/** Removes traversal segments and normalizes browser directory separators. */
export function normalizeAssetUploadRelativePath(path: string) {
  const segments = path
    .replaceAll('\\', '/')
    .split('/')
    .filter(segment => segment && segment !== '.' && segment !== '..')

  return segments.length > 1 ? segments.join('/') : null
}
