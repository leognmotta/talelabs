import { useListBrands } from '@talelabs/sdk'

export function useBrandOptions() {
  return useListBrands({ params: { limit: 200 } })
}
