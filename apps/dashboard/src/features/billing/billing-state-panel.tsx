/** Shared compact pending and error states for Settings Billing destinations. */

import { IconAlertCircle } from '@tabler/icons-react'
import { Button } from '@talelabs/ui/components/button'
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@talelabs/ui/components/empty'
import { Skeleton } from '@talelabs/ui/components/skeleton'
import { useTranslation } from 'react-i18next'

/** Renders a compact Settings loading skeleton. */
export function BillingLoadingState() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-8 w-44" />
      <Skeleton className="h-28 w-full rounded-3xl" />
      <Skeleton className="h-28 w-full rounded-3xl" />
    </div>
  )
}

/** Renders a localized retry boundary for Billing query failures. */
export function BillingErrorState({ retry }: { retry: () => void }) {
  const { t } = useTranslation()
  return (
    <Empty className="min-h-48 p-6">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <IconAlertCircle />
        </EmptyMedia>
        <EmptyTitle>{t('billing.couldNotLoad')}</EmptyTitle>
      </EmptyHeader>
      <EmptyContent>
        <Button type="button" variant="outline" onClick={retry}>
          {t('common.retry')}
        </Button>
      </EmptyContent>
    </Empty>
  )
}
