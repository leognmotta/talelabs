import { IconPackage } from '@tabler/icons-react'
import { listProducts, listProductsQueryKey } from '@talelabs/sdk'
import { Outlet, useLocation } from 'react-router'
import { getApiErrorMessage } from '../../shared/lib/api-error'
import { ContextResourceList } from '../context/context-resource-list'
import { ContextWorkspace } from '../context/context-workspace'
import { useContextInfiniteList } from '../context/use-context-infinite-list'
import { useContextListSearch } from '../context/use-context-list-search'

export function ProductsLayout() {
  const location = useLocation()
  const { deferredSearch, search, setSearch } = useContextListSearch()
  const params = { limit: 50, search: deferredSearch }
  const query = useContextInfiniteList({
    queryKey: listProductsQueryKey(params),
    loadPage: cursor => listProducts({ params: { ...params, cursor } }),
  })
  return (
    <ContextWorkspace
      isDetailOpen={location.pathname !== '/products'}
      sidebar={(
        <ContextResourceList
          basePath="/products"
          createLabel="New product"
          error={
            query.error
              ? getApiErrorMessage(query.error, 'Could not load products.')
              : null
          }
          icon={IconPackage}
          hasNextPage={query.hasNextPage}
          isFetchingNextPage={query.isFetchingNextPage}
          items={query.items}
          loading={query.isPending}
          onLoadMore={() => void query.fetchNextPage()}
          onRetry={() => void query.refetch()}
          onSearch={setSearch}
          resourceName="Products"
          search={search}
        />
      )}
      detail={<Outlet />}
    />
  )
}
