/**
 * Root React Router error presentation for route renders and data failures.
 *
 * React Router catches these errors before an Error Boundary surrounding
 * RouterProvider can observe them, so the data-router route owns this fallback.
 */

import { useEffect } from 'react'
import { useLocation, useNavigate, useRouteError } from 'react-router'

import { ErrorFallback } from '../shared/components/error-fallback'

/** Renders the localized full-screen fallback and retries the current route. */
export function RouteErrorBoundary() {
  const error = useRouteError()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    console.error('React Router caught a route error.', error)
  }, [error])

  return (
    <ErrorFallback
      fullScreen
      onRetry={() => void navigate({
        hash: location.hash,
        pathname: location.pathname,
        search: location.search,
      }, { replace: true })}
    />
  )
}
