import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AppProviders } from './app/providers'
import { DashboardRoutes } from './app/routes'
import { applyThemePreference, getInitialThemePreference } from './shared/lib/theme'
import '@talelabs/ui/globals.css'
import './index.css'

applyThemePreference(getInitialThemePreference())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <DashboardRoutes />
    </AppProviders>
  </StrictMode>,
)
