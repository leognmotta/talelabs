import { IconPalette } from '@tabler/icons-react'
import { listBrands, listBrandsQueryKey } from '@talelabs/sdk'
import { Outlet, useLocation } from 'react-router'
import { getApiErrorMessage } from '../../shared/lib/api-error'
import { ContextResourceList } from '../context/context-resource-list'
import { ContextWorkspace } from '../context/context-workspace'
import { useContextInfiniteList } from '../context/use-context-infinite-list'
import { useContextListSearch } from '../context/use-context-list-search'

export function BrandsLayout() {
  const location = useLocation()
  const { deferredSearch, search, setSearch } = useContextListSearch()
  const params = { limit: 50, search: deferredSearch }
  const query = useContextInfiniteList({
    queryKey: listBrandsQueryKey(params),
    loadPage: cursor => listBrands({ params: { ...params, cursor } }),
  })
  return (
    <ContextWorkspace
      isDetailOpen={location.pathname !== '/brands'}
      sidebar={(
        <ContextResourceList
          basePath="/brands"
          createLabel="New brand"
          error={
            query.error
              ? getApiErrorMessage(query.error, 'Could not load brands.')
              : null
          }
          icon={IconPalette}
          hasNextPage={query.hasNextPage}
          isFetchingNextPage={query.isFetchingNextPage}
          items={query.items}
          loading={query.isPending}
          onLoadMore={() => void query.fetchNextPage()}
          onRetry={() => void query.refetch()}
          onSearch={setSearch}
          resourceName="Brands"
          search={search}
        />
      )}
      detail={<Outlet />}
    />
  )
}
