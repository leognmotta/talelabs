import { IconUserStar } from '@tabler/icons-react'
import { listCharacters, listCharactersQueryKey } from '@talelabs/sdk'
import { Outlet, useLocation } from 'react-router'
import { getApiErrorMessage } from '../../shared/lib/api-error'
import { ContextResourceList } from '../context/context-resource-list'
import { ContextWorkspace } from '../context/context-workspace'
import { useContextInfiniteList } from '../context/use-context-infinite-list'
import { useContextListSearch } from '../context/use-context-list-search'

export function CharactersLayout() {
  const location = useLocation()
  const { deferredSearch, search, setSearch } = useContextListSearch()
  const params = { limit: 50, search: deferredSearch }
  const query = useContextInfiniteList({
    queryKey: listCharactersQueryKey(params),
    loadPage: cursor => listCharacters({ params: { ...params, cursor } }),
  })
  return (
    <ContextWorkspace
      isDetailOpen={location.pathname !== '/characters'}
      sidebar={(
        <ContextResourceList
          basePath="/characters"
          createLabel="New character"
          error={
            query.error
              ? getApiErrorMessage(query.error, 'Could not load characters.')
              : null
          }
          icon={IconUserStar}
          hasNextPage={query.hasNextPage}
          isFetchingNextPage={query.isFetchingNextPage}
          items={query.items.map(item => ({
            ...item,
            description: item.role || item.description,
          }))}
          loading={query.isPending}
          onLoadMore={() => void query.fetchNextPage()}
          onRetry={() => void query.refetch()}
          onSearch={setSearch}
          resourceName="Characters"
          search={search}
        />
      )}
      detail={<Outlet />}
    />
  )
}
