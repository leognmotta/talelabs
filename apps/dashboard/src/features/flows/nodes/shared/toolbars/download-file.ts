/** Creates and revokes a browser object URL for a generated download payload. */
export function downloadFile(input: {
  content: BlobPart
  fileName: string
  mimeType: string
}) {
  const blob = new Blob([input.content], { type: input.mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.download = input.fileName
  anchor.href = url
  anchor.hidden = true
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
