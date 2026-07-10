import type { QueryKey } from '@tanstack/react-query'

import { useInfiniteQuery } from '@tanstack/react-query'

interface CursorPage<Item> {
  data: Item[]
  nextCursor: string | null
}

export function useContextInfiniteList<Item>({
  loadPage,
  queryKey,
}: {
  loadPage: (cursor?: string) => Promise<CursorPage<Item>>
  queryKey: QueryKey
}) {
  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => loadPage(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: page => page.nextCursor ?? undefined,
  })

  return {
    ...query,
    items: query.data?.pages.flatMap(page => page.data) ?? [],
  }
}
