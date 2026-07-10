import type { QueryClient, QueryKey } from '@tanstack/react-query'

const contextQueryUrls = new Set([
  '/brands',
  '/brands/:brandId',
  '/characters',
  '/characters/:characterId',
  '/products',
  '/products/:productId',
  '/projects',
  '/projects/:projectId',
])

export function isContextQueryKey(queryKey: QueryKey) {
  const root = queryKey[0]

  if (!root || typeof root !== 'object' || !('url' in root))
    return false

  return typeof root.url === 'string' && contextQueryUrls.has(root.url)
}

export async function clearContextQueries(queryClient: QueryClient) {
  await queryClient.cancelQueries({
    predicate: query => isContextQueryKey(query.queryKey),
  })

  queryClient.removeQueries({
    predicate: query => isContextQueryKey(query.queryKey),
  })
}
