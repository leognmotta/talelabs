import type {
  CreateBrandMutationRequest,
  UpdateBrandMutationRequest,
} from '@talelabs/sdk'
import {
  createBrand,
  deleteBrand,
  getBrandQueryKey,
  listBrandsQueryKey,
  updateBrand,
} from '@talelabs/sdk'
import { useMutation, useQueryClient } from '@tanstack/react-query'

export function useCreateBrandMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateBrandMutationRequest) => createBrand({ data }),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: listBrandsQueryKey() }),
  })
}
export function useUpdateBrandMutation(brandId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateBrandMutationRequest) =>
      updateBrand({ brandId, data }),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: listBrandsQueryKey() }),
        client.invalidateQueries({ queryKey: getBrandQueryKey({ brandId }) }),
      ]),
  })
}
export function useDeleteBrandMutation(brandId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => deleteBrand({ brandId }),
    onSuccess: async () => {
      client.removeQueries({ queryKey: getBrandQueryKey({ brandId }) })
      await client.invalidateQueries({ queryKey: listBrandsQueryKey() })
    },
  })
}
