import {
  getElementsIdAssets,
  patchElementsIdAssetsAssetid,
  postElementsIdAssets,
} from '@talelabs/sdk'
import { getOrganizationRequestHeaders } from '../../shared/lib/organization-request'

export interface ElementUploadTarget {
  elementId: string
  isPrimary: boolean
  kind: 'element'
  role: string
  sortOrder: number
}

export type UploadTarget = { kind: 'asset' } | ElementUploadTarget

export async function linkElementUploadTarget(
  target: ElementUploadTarget,
  assetId: string,
  organizationId: string,
  signal: AbortSignal,
) {
  const headers = getOrganizationRequestHeaders(organizationId)
  try {
    return await postElementsIdAssets({
      id: target.elementId,
      data: {
        assetId,
        isPrimary: target.isPrimary,
        role: target.role,
        sortOrder: target.sortOrder,
      },
    }, { headers, signal })
  }
  catch (error) {
    if (signal.aborted)
      throw error

    // A lost response may hide a committed link. Reconcile it without
    // registering or uploading the canonical Asset a second time.
    let existing
    try {
      const kit = await getElementsIdAssets({
        id: target.elementId,
        params: { referenceKind: 'master', role: target.role },
      }, { headers, signal })
      existing = kit.data.find(link => (
        link.assetId === assetId && link.referenceKind === 'master'
      ))
    }
    catch {
      throw error
    }

    if (!existing)
      throw error
    if (
      existing.isPrimary === target.isPrimary
      && existing.sortOrder === target.sortOrder
    ) {
      return existing
    }

    return patchElementsIdAssetsAssetid({
      assetId,
      id: target.elementId,
      data: {
        isPrimary: target.isPrimary,
        role: target.role,
        sortOrder: target.sortOrder,
      },
    }, { headers, signal })
  }
}
