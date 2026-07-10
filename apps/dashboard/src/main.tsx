import { setApiRequestLocale } from '@talelabs/sdk'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AppProviders } from './app/providers'
import { DashboardRoutes } from './app/routes'
import { getResolvedLocale, i18n, initializeI18n } from './i18n/i18n'
import { applyThemePreference, getInitialThemePreference } from './shared/lib/theme'
import '@talelabs/ui/globals.css'

async function bootstrap() {
  applyThemePreference(getInitialThemePreference())
  await initializeI18n()
  setApiRequestLocale(getResolvedLocale())
  i18n.on('languageChanged', () => setApiRequestLocale(getResolvedLocale()))

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AppProviders>
        <DashboardRoutes />
      </AppProviders>
    </StrictMode>,
  )
}

void bootstrap()
