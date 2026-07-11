export interface AssetUploadBatch {
  organizationId: string
  signal: AbortSignal
}

export type RunAssetUploadBatch = <Result>(
  operation: (batch: AssetUploadBatch) => Promise<Result>,
) => Promise<Result>

export function createAssetUploadAbortError() {
  return new DOMException('Upload canceled', 'AbortError')
}

export function isAssetUploadAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

export function throwIfAssetUploadBatchInactive(
  batch: AssetUploadBatch,
  activeOrganizationId: null | string,
) {
  if (
    batch.signal.aborted
    || activeOrganizationId !== batch.organizationId
  ) {
    throw createAssetUploadAbortError()
  }
}
