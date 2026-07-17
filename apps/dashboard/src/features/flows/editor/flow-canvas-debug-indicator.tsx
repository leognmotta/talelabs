/** Persistent in-canvas warning shown while provider calls are disabled. */

import { IconBug } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'

/** Renders the persistent warning that canvas outputs are simulated. */
export function FlowCanvasDebugIndicator() {
  const { t } = useTranslation()

  return (
    <div
      className="
        flex items-center gap-2 rounded-full border border-warning/60 bg-warning
        px-3 py-1.5 text-xs font-semibold text-warning-foreground shadow-lg
      "
      role="status"
    >
      <IconBug aria-hidden className="size-4" />
      <span>{t('flows.debugMode.active')}</span>
      <span aria-hidden className="size-1 rounded-full bg-current opacity-50" />
      <span className="font-medium opacity-80">
        {t('flows.debugMode.mockOutputsOnly')}
      </span>
    </div>
  )
}
