import { Progress } from '@talelabs/ui/components/progress'
/* eslint-disable better-tailwindcss/no-unknown-classes -- React Flow uses these interaction classes as behavior hooks. */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

export function FlowNodeUploadProgress({
  name,
  progress,
}: {
  name: string
  progress: number
}) {
  const { i18n, t } = useTranslation()
  const percentage = useMemo(
    () => new Intl.NumberFormat(i18n.resolvedLanguage ?? 'en', {
      maximumFractionDigits: 0,
      style: 'percent',
    }).format(progress),
    [i18n.resolvedLanguage, progress],
  )
  const label = `${t('uploads.stages.uploading')}: ${name} · ${percentage}`

  return (
    <div className="
      nodrag nopan absolute inset-x-3 bottom-3 rounded-lg border
      border-border/80 bg-card/90 p-2 shadow-lg backdrop-blur-sm
    "
    >
      <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
        <span className="truncate text-muted-foreground">
          {t('uploads.stages.uploading')}
        </span>
        <span className="shrink-0 font-medium tabular-nums">{percentage}</span>
      </div>
      <Progress aria-label={label} value={progress * 100} />
    </div>
  )
}
