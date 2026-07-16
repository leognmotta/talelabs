import {
  IconAlertCircle,
  IconCheck,
  IconCloudUpload,
} from '@tabler/icons-react'
import { Badge } from '@talelabs/ui/components/badge'
import { Button } from '@talelabs/ui/components/button'
import { Sheet } from '@talelabs/ui/components/sheet'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@talelabs/ui/components/tooltip'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from 'zustand'
import { useActiveOrganizationId } from '../organizations/organization-scope-context'
import { UploadPanel } from './upload-panel'
import { uploadStore } from './upload-store'
import { isActiveUploadStatus } from './upload.types'

export function UploadIndicator() {
  const { i18n, t } = useTranslation()
  const organizationId = useActiveOrganizationId()
  const [open, setOpen] = useState(false)
  const activeCount = useStore(uploadStore, state => state.itemOrder.reduce(
    (count, id) => {
      const item = state.items[id]
      return count + Number(item?.organizationId === organizationId
        && isActiveUploadStatus(item.status))
    },
    0,
  ))
  const failedCount = useStore(uploadStore, state => state.itemOrder.reduce(
    (count, id) => {
      const item = state.items[id]
      return count + Number(item?.organizationId === organizationId
        && item.status === 'failed')
    },
    0,
  ))
  const completedCount = useStore(uploadStore, state => state.itemOrder.reduce(
    (count, id) => {
      const item = state.items[id]
      return count + Number(item?.organizationId === organizationId
        && item.status === 'completed')
    },
    0,
  ))
  const aggregateProgress = useStore(uploadStore, (state) => {
    const active = state.itemOrder
      .map(id => state.items[id])
      .filter(item => item?.organizationId === organizationId
        && isActiveUploadStatus(item.status))
    return active.length
      ? active.reduce((total, item) => total + item.progress, 0) / active.length
      : 0
  })
  const percentage = useMemo(
    () => new Intl.NumberFormat(i18n.resolvedLanguage ?? 'en', {
      maximumFractionDigits: 0,
      style: 'percent',
    }).format(aggregateProgress),
    [aggregateProgress, i18n.resolvedLanguage],
  )
  const count = activeCount || failedCount || completedCount
  const label = activeCount
    ? t('uploads.openActive', { count: activeCount, progress: percentage })
    : failedCount
      ? t('uploads.openFailed', { count: failedCount })
      : t('uploads.open')

  if (!organizationId)
    return null

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger
          render={(
            <Button
              aria-label={label}
              className="relative"
              size="icon"
              type="button"
              variant="outline"
              onClick={() => setOpen(true)}
            />
          )}
        >
          {failedCount > 0 && activeCount === 0
            ? <IconAlertCircle className="text-destructive" />
            : completedCount > 0 && activeCount === 0
              ? <IconCheck className="text-success" />
              : <IconCloudUpload />}
          {count > 0 && (
            <Badge className="absolute -top-1 -right-1 min-w-4 px-1 text-[10px]" variant={failedCount && !activeCount ? 'destructive' : 'default'}>
              {count > 99 ? '99+' : count}
            </Badge>
          )}
          {activeCount > 0 && (
            <span
              aria-hidden="true"
              className="
                absolute bottom-0 left-0 h-0.5 bg-primary transition-[width]
              "
              style={{ width: `${aggregateProgress * 100}%` }}
            />
          )}
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
      {open && <UploadPanel organizationId={organizationId} />}
    </Sheet>
  )
}
