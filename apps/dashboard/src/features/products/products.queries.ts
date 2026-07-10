import type {
  CreateProductMutationRequest,
  UpdateProductMutationRequest,
} from '@talelabs/sdk'
import {
  createProduct,
  deleteProduct,
  getProductQueryKey,
  listProductsQueryKey,
  updateProduct,
} from '@talelabs/sdk'
import { useMutation, useQueryClient } from '@tanstack/react-query'

export function useCreateProductMutation() {
  const c = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateProductMutationRequest) => createProduct({ data }),
    onSuccess: () => c.invalidateQueries({ queryKey: listProductsQueryKey() }),
  })
}
export function useUpdateProductMutation(productId: string) {
  const c = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateProductMutationRequest) =>
      updateProduct({ productId, data }),
    onSuccess: () =>
      Promise.all([
        c.invalidateQueries({ queryKey: listProductsQueryKey() }),
        c.invalidateQueries({ queryKey: getProductQueryKey({ productId }) }),
      ]),
  })
}
export function useDeleteProductMutation(productId: string) {
  const c = useQueryClient()
  return useMutation({
    mutationFn: () => deleteProduct({ productId }),
    onSuccess: async () => {
      c.removeQueries({ queryKey: getProductQueryKey({ productId }) })
      await c.invalidateQueries({ queryKey: listProductsQueryKey() })
    },
  })
}
