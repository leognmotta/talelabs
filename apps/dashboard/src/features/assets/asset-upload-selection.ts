export interface AssetUploadSelection {
  file: File
  relativePath: string | null
}

function normalizeRelativePath(path: string) {
  const segments = path
    .replaceAll('\\', '/')
    .split('/')
    .filter(segment => segment && segment !== '.' && segment !== '..')

  return segments.length > 1 ? segments.join('/') : null
}

export function getAssetUploadSelections(files: File[] | FileList): AssetUploadSelection[] {
  return Array.from(files, file => ({
    file,
    relativePath: normalizeRelativePath(file.webkitRelativePath),
  }))
}

function getFileFromEntry(entry: FileSystemFileEntry) {
  return new Promise<File>((resolve, reject) => entry.file(resolve, reject))
}

async function readDirectoryEntries(entry: FileSystemDirectoryEntry) {
  const reader = entry.createReader()
  const entries: FileSystemEntry[] = []

  while (true) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => {
      reader.readEntries(resolve, reject)
    })

    if (batch.length === 0)
      return entries

    entries.push(...batch)
  }
}

async function readEntry(
  entry: FileSystemEntry,
  parentPath: string,
): Promise<AssetUploadSelection[]> {
  const path = parentPath ? `${parentPath}/${entry.name}` : entry.name

  if (entry.isFile) {
    const file = await getFileFromEntry(entry as FileSystemFileEntry)
    return [{ file, relativePath: normalizeRelativePath(path) }]
  }

  if (!entry.isDirectory)
    return []

  const children = await readDirectoryEntries(entry as FileSystemDirectoryEntry)
  const nestedSelections = await Promise.all(children.map(child => readEntry(child, path)))
  return nestedSelections.flat()
}

export async function getDroppedAssetUploadSelections(dataTransfer: DataTransfer) {
  const fileItems = Array.from(dataTransfer.items).filter(item => item.kind === 'file')
  const entries = fileItems
    .map(item => item.webkitGetAsEntry())
    .filter((entry): entry is FileSystemEntry => Boolean(entry))

  if (entries.some(entry => entry.isDirectory)) {
    const selections = await Promise.all(entries.map((entry) => {
      if (entry.isFile) {
        return getFileFromEntry(entry as FileSystemFileEntry)
          .then(file => [{ file, relativePath: null }])
      }

      return readEntry(entry, '')
    }))

    return selections.flat()
  }

  return getAssetUploadSelections(dataTransfer.files)
}
