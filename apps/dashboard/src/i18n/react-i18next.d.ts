import type { DashboardCatalog } from '@talelabs/i18n/catalogs'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'dashboard'
    nsSeparator: ':'
    resources: {
      dashboard: DashboardCatalog['default']
    }
  }
}
