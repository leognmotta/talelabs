import type { ComponentType } from 'react'
import { IconSearch } from '@tabler/icons-react'
import { buttonVariants } from '@talelabs/ui/components/button'
import { Input } from '@talelabs/ui/components/input'
import { Skeleton } from '@talelabs/ui/components/skeleton'
import { Link, NavLink } from 'react-router'
import { ContextEmptyState } from './context-empty-state'

export interface ContextListItem {
  description?: string | null
  id: string
  name: string
}

export function ContextResourceList({
  basePath,
  createLabel,
  error,
  icon: Icon,
  items,
  hasNextPage,
  isFetchingNextPage,
  loading,
  onLoadMore,
  onRetry,
  onSearch,
  resourceName,
  search,
}: {
  basePath: string
  createLabel: string
  error: string | null
  icon: ComponentType<{ className?: string }>
  items: ContextListItem[]
  hasNextPage: boolean
  isFetchingNextPage: boolean
  loading: boolean
  onLoadMore: () => void
  onRetry: () => void
  onSearch: (value: string) => void
  resourceName: string
  search: string
}) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-start justify-between gap-3 border-b p-4">
        <div>
          <h1 className="text-base font-semibold">{resourceName}</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {loading ? 'Loading...' : `${items.length} shown`}
          </p>
        </div>
        <Link className={buttonVariants({ size: 'sm' })} to={`${basePath}/new`}>
          {createLabel}
        </Link>
      </header>
      <div className="border-b p-3">
        <div className="relative">
          <IconSearch
            className="
              pointer-events-none absolute top-1/2 left-3 size-4
              -translate-y-1/2 text-muted-foreground
            "
          />
          <Input
            aria-label={`Search ${resourceName.toLowerCase()}`}
            className="pl-9"
            placeholder={`Search ${resourceName.toLowerCase()}`}
            value={search}
            onChange={event => onSearch(event.target.value)}
          />
        </div>
      </div>
      {loading && (
        <div className="flex flex-col gap-4 p-4">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton className="h-14 w-full rounded-lg" key={index} />
          ))}
        </div>
      )}
      {!loading && error && (
        <ContextEmptyState
          description={error}
          icon={Icon}
          title={`${resourceName} unavailable`}
          action={(
            <button
              className={buttonVariants({ variant: 'outline' })}
              type="button"
              onClick={onRetry}
            >
              Try again
            </button>
          )}
        />
      )}
      {!loading && !error && items.length === 0 && (
        <ContextEmptyState
          description={
            search
              ? `No ${resourceName.toLowerCase()} match this search.`
              : undefined
          }
          icon={Icon}
          title={search ? 'No matches' : `No ${resourceName.toLowerCase()} yet`}
          action={
            search
              ? undefined
              : (
                  <Link className={buttonVariants()} to={`${basePath}/new`}>
                    {createLabel}
                  </Link>
                )
          }
        />
      )}
      {!loading && !error && items.length > 0 && (
        <>
          <nav aria-label={resourceName} className="flex flex-col gap-1 p-2">
            {items.map(item => (
              <NavLink
                className="
                  flex items-start gap-3 rounded-lg px-3 py-2.5 text-sm
                  hover:bg-muted
                  aria-[current=page]:bg-muted
                "
                key={item.id}
                to={`${basePath}/${item.id}`}
              >
                <Icon className="mt-0.5 size-4 shrink-0" />
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {item.name}
                  </span>
                  <span className="
                    mt-0.5 block truncate text-xs text-muted-foreground
                  "
                  >
                    {item.description || 'No description'}
                  </span>
                </span>
              </NavLink>
            ))}
          </nav>
          {hasNextPage && (
            <div className="mt-auto border-t p-3">
              <button
                className={buttonVariants({ variant: 'outline' })}
                disabled={isFetchingNextPage}
                type="button"
                onClick={onLoadMore}
              >
                {isFetchingNextPage ? 'Loading...' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
