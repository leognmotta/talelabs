/** Quiet autosave status chip presented beside the Flow name. */

import type { FlowSaveStatus } from './flow-canvas-types'

import { IconAlertTriangle, IconCheck, IconRefresh } from '@tabler/icons-react'
import { Spinner } from '@talelabs/ui/components/spinner'
import { useTranslation } from 'react-i18next'

/** Renders the current autosave state; the error state doubles as a retry button. */
export function FlowCanvasSaveStatus({
  status,
  onRetrySave,
}: {
  status: FlowSaveStatus
  onRetrySave: () => void
}) {
  const { t } = useTranslation()

  if (status === 'error') {
    return (
      <button
        className="
          flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium
          text-destructive
          hover:bg-destructive/10
        "
        data-flow-save-status="error"
        type="button"
        onClick={onRetrySave}
      >
        <IconRefresh aria-hidden className="size-3.5" />
        {t('flows.saveStatus.error')}
      </button>
    )
  }

  if (status === 'conflict') {
    return (
      <span
        className="
          flex items-center gap-1.5 px-2 py-1 text-xs font-medium
          text-destructive
        "
        data-flow-save-status="conflict"
      >
        <IconAlertTriangle aria-hidden className="size-3.5" />
        {t('flows.saveStatus.conflict')}
      </span>
    )
  }

  if (status === 'saving' || status === 'unsaved') {
    return (
      <span className="
        flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground
      "
      >
        <Spinner aria-hidden className="size-3" />
        {t(status === 'saving' ? 'flows.saveStatus.saving' : 'flows.saveStatus.unsaved')}
      </span>
    )
  }

  return (
    <span className="
      flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground
    "
    >
      <IconCheck aria-hidden className="size-3.5" />
      {t('flows.saveStatus.saved')}
    </span>
  )
}
