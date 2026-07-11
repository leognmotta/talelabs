import type { ReactNode } from 'react'

import { QueryClientProvider } from '@tanstack/react-query'
import { NuqsAdapter } from 'nuqs/adapters/react-router/v7'
import { BrowserRouter } from 'react-router'
import { LanguageProvider } from '../i18n/language-provider'
import { ErrorBoundary } from '../shared/components/error-boundary'
import { ErrorFallback } from '../shared/components/error-fallback'
import { queryClient } from './query-client'

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <LanguageProvider>
      <ErrorBoundary
        fallback={({ resetErrorBoundary }) => (
          <ErrorFallback fullScreen onRetry={resetErrorBoundary} />
        )}
      >
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <NuqsAdapter>
              {children}
            </NuqsAdapter>
          </BrowserRouter>
        </QueryClientProvider>
      </ErrorBoundary>
    </LanguageProvider>
  )
}
