import type { ReactNode } from 'react'

import { QueryClientProvider } from '@tanstack/react-query'
import { NuqsAdapter } from 'nuqs/adapters/react-router/v7'
import { BrowserRouter } from 'react-router'
import { queryClient } from './query-client'

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <NuqsAdapter>
          {children}
        </NuqsAdapter>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
