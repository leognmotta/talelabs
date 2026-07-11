import { useQueryState } from 'nuqs'
import { useCallback } from 'react'
import { parseAsCuid2 } from '../../shared/lib/search-param-parsers'

export function useAssetViewerUrlState() {
  const [assetId, setAssetId] = useQueryState('asset', parseAsCuid2)

  const openAsset = useCallback((id: string) => {
    void setAssetId(id, { history: 'push' })
  }, [setAssetId])

  const closeAsset = useCallback(() => {
    void setAssetId(null, { history: 'replace' })
  }, [setAssetId])

  return { assetId, closeAsset, openAsset }
}
