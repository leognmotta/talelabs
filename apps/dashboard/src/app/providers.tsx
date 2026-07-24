/** Dashboard-wide routing, data, localization, and error-boundary composition. */

import { QueryClientProvider } from '@tanstack/react-query'
import { NuqsAdapter } from 'nuqs/adapters/react-router/v7'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { LanguageProvider } from '../i18n/language-provider'
import { ErrorBoundary } from '../shared/components/error-boundary'
import { ErrorFallback } from '../shared/components/error-fallback'
import { queryClient } from './query-client'
import { RouteErrorBoundary } from './route-error-boundary'
import { DashboardRoutes } from './routes'

const router = createBrowserRouter([{
  ErrorBoundary: RouteErrorBoundary,
  path: '*',
  element: (
    <NuqsAdapter>
      <DashboardRoutes />
    </NuqsAdapter>
  ),
}])

/** Composes the dashboard's global providers around its data router. */
export function AppProviders() {
  return (
    <LanguageProvider>
      <ErrorBoundary
        fallback={({ resetErrorBoundary }) => (
          <ErrorFallback fullScreen onRetry={resetErrorBoundary} />
        )}
      >
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </ErrorBoundary>
    </LanguageProvider>
  )
}
