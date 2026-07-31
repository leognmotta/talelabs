/** Usage Settings destination for content, storage, generation, and transactions. */

import {
  IconBox,
  IconChevronLeft,
  IconChevronRight,
  IconFolder,
  IconPhoto,
} from '@tabler/icons-react'
import { Button } from '@talelabs/ui/components/button'
import { Progress } from '@talelabs/ui/components/progress'
import { Separator } from '@talelabs/ui/components/separator'
import { Tabs, TabsList, TabsTrigger } from '@talelabs/ui/components/tabs'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ElementIcon } from '../../shared/domain-icons'
import {
  formatBytes,
  formatCredits,
} from './billing-format'
import { BillingMonthPicker } from './billing-month-picker'
import {
  useBillingAccountQuery,
  useBillingLedgerQuery,
  useBillingUsageMonthsQuery,
  useBillingUsageQuery,
} from './billing-queries'
import { BillingRunHistoryTable } from './billing-run-history-table'
import {
  BillingErrorState,
  BillingLoadingState,
} from './billing-state-panel'

function currentUtcMonth() {
  return new Date().toISOString().slice(0, 7)
}

/** Renders the Usage overview and bounded selected-month detail. */
export function BillingUsageSettings({
  organizationId,
}: {
  /** Active organization identity used only in organization-keyed queries. */
  organizationId: null | string
}) {
  const { i18n, t } = useTranslation()
  const [selectedMonth, setSelectedMonth] = useState<null | string>(null)
  const [detail, setDetail] = useState<'generation' | 'transactions'>(
    'generation',
  )
  const [ledgerCursors, setLedgerCursors] = useState<(null | string)[]>([null])
  const ledgerCursor = ledgerCursors.at(-1) ?? null
  const accountQuery = useBillingAccountQuery(organizationId)
  const monthsQuery = useBillingUsageMonthsQuery(organizationId)
  const availableMonths = monthsQuery.data?.items ?? []
  const month = selectedMonth && availableMonths.includes(selectedMonth)
    ? selectedMonth
    : availableMonths[0] ?? currentUtcMonth()
  const usageQuery = useBillingUsageQuery(
    organizationId,
    month,
    monthsQuery.isSuccess,
  )
  const canReadLedger = accountQuery.data?.permissions.canManageBilling ?? false
  const ledgerQuery = useBillingLedgerQuery(
    organizationId,
    month,
    ledgerCursor,
    canReadLedger && detail === 'transactions',
  )

  if (
    accountQuery.isPending
    || monthsQuery.isPending
    || usageQuery.isPending
  ) {
    return <BillingLoadingState />
  }
  if (!accountQuery.data || !monthsQuery.data || !usageQuery.data) {
    return (
      <BillingErrorState retry={() => {
        void accountQuery.refetch()
        void monthsQuery.refetch()
        void usageQuery.refetch()
      }}
      />
    )
  }

  const account = accountQuery.data
  const usage = usageQuery.data
  const storageCommitted = account.storage.usedBytes
    + account.storage.reservedBytes
  const storagePercent = account.storage.limitBytes === 0
    ? 100
    : Math.min(100, storageCommitted / account.storage.limitBytes * 100)
  const cards = [
    {
      icon: IconFolder,
      label: t('billing.projects'),
      primary: usage.content.projects.count,
      secondary: t('billing.projectAssets', {
        count: usage.content.projects.assetCount,
      }),
    },
    {
      icon: IconPhoto,
      label: t('billing.assets'),
      primary: usage.content.assets.count,
      secondary: formatBytes(
        usage.content.assets.usedBytes,
        i18n.language,
      ),
    },
    {
      icon: ElementIcon,
      label: t('billing.elements'),
      primary: usage.content.elements.count,
      secondary: t('billing.elementReferences', {
        count: usage.content.elements.referenceCount,
      }),
    },
  ]

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <header>
        <h2 className="text-lg font-semibold">{t('billing.usage')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('billing.usageDescription')}
        </p>
      </header>
      <Separator />
      <div className="
        grid grid-cols-1 gap-2
        sm:grid-cols-3
      "
      >
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <section
              className="rounded-3xl bg-muted/35 p-4"
              key={card.label}
            >
              <div className="flex items-center gap-2 text-muted-foreground">
                <Icon className="size-4" />
                <p className="text-sm">{card.label}</p>
              </div>
              <p className="mt-3 text-2xl font-semibold tabular-nums">
                {new Intl.NumberFormat(i18n.language).format(card.primary)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {card.secondary}
              </p>
            </section>
          )
        })}
      </div>
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-medium">{t('billing.storage')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('billing.storageUsedOf', {
                limit: formatBytes(
                  account.storage.limitBytes,
                  i18n.language,
                ),
                used: formatBytes(
                  account.storage.usedBytes,
                  i18n.language,
                ),
              })}
            </p>
          </div>
          <IconBox className="size-5 text-muted-foreground" />
        </div>
        <Progress value={storagePercent} />
        {account.storage.reservedBytes > 0 && (
          <p className="text-xs text-muted-foreground">
            {t('billing.storageReserved', {
              amount: formatBytes(
                account.storage.reservedBytes,
                i18n.language,
              ),
            })}
          </p>
        )}
        <div className="
          grid grid-cols-2 gap-x-4 gap-y-2 text-sm
          sm:grid-cols-4
        "
        >
          {usage.content.assets.byMediaType.map(item => (
            <div className="flex justify-between gap-2" key={item.mediaType}>
              <span className="text-muted-foreground">
                {t(`billing.mediaTypes.${item.mediaType}`)}
              </span>
              <span className="tabular-nums">
                {formatBytes(item.usedBytes, i18n.language)}
              </span>
            </div>
          ))}
        </div>
      </section>
      <Separator />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={detail}
          onValueChange={value => setDetail(
            value as 'generation' | 'transactions',
          )}
        >
          <TabsList>
            <TabsTrigger value="generation">
              {t('billing.generationUsage')}
            </TabsTrigger>
            {canReadLedger && (
              <TabsTrigger value="transactions">
                {t('billing.transactions')}
              </TabsTrigger>
            )}
          </TabsList>
        </Tabs>
        <BillingMonthPicker
          availableMonths={availableMonths}
          value={month}
          onValueChange={(value) => {
            setSelectedMonth(value)
            setLedgerCursors([null])
          }}
        />
      </div>
      {detail === 'generation'
        ? (
            <>
              <section className="
                grid grid-cols-2 gap-4
                sm:grid-cols-4
              "
              >
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t('billing.runs')}
                  </p>
                  <p className="mt-1 text-xl font-semibold tabular-nums">
                    {usage.generation.runCount}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t('billing.successfulOutputs')}
                  </p>
                  <p className="mt-1 text-xl font-semibold tabular-nums">
                    {usage.generation.successfulOutputCount}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t('billing.capturedCredits')}
                  </p>
                  <p className="mt-1 text-xl font-semibold tabular-nums">
                    {formatCredits(
                      usage.generation.capturedCredits,
                      i18n.language,
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t('billing.releasedCredits')}
                  </p>
                  <p className="mt-1 text-xl font-semibold tabular-nums">
                    {formatCredits(
                      usage.generation.releasedCredits,
                      i18n.language,
                    )}
                  </p>
                </div>
                {Object.entries(usage.generation.outputsByMediaType).map(
                  ([mediaType, count]) => (
                    <div className="text-sm" key={mediaType}>
                      <span className="text-muted-foreground">
                        {t(`billing.mediaTypes.${mediaType}`)}
                      </span>
                      <span className="ml-2 font-medium tabular-nums">
                        {count}
                      </span>
                    </div>
                  ),
                )}
              </section>
              <Separator />
              <BillingRunHistoryTable
                key={month}
                month={month}
                organizationId={organizationId}
              />
            </>
          )
        : ledgerQuery.isPending
          ? <BillingLoadingState />
          : ledgerQuery.data
            ? (
                <section className="flex flex-col">
                  {ledgerQuery.data.items.length === 0
                    ? (
                        <p className="
                          py-8 text-center text-sm text-muted-foreground
                        "
                        >
                          {t('billing.noTransactions')}
                        </p>
                      )
                    : ledgerQuery.data.items.map(item => (
                        <div
                          className="
                            flex items-center justify-between gap-4 border-b
                            border-border/70 py-3
                            last:border-0
                          "
                          key={item.id}
                        >
                          <div>
                            <p className="text-sm font-medium">
                              {t(
                                `billing.ledgerReasons.${item.reasonCode}`,
                                {
                                  defaultValue: t('billing.transaction'),
                                },
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Intl.DateTimeFormat(i18n.language, {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              }).format(new Date(item.createdAt))}
                            </p>
                          </div>
                          <div className="text-right text-sm tabular-nums">
                            {item.availableDelta !== 0 && (
                              <p>
                                {item.availableDelta > 0 ? '+' : ''}
                                {formatCredits(
                                  item.availableDelta,
                                  i18n.language,
                                )}
                              </p>
                            )}
                            {item.reservedDelta !== 0 && (
                              <p className="text-xs text-muted-foreground">
                                {t('billing.reservedDelta', {
                                  count: formatCredits(
                                    item.reservedDelta,
                                    i18n.language,
                                  ),
                                })}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                  <div className="mt-3 flex justify-end gap-2">
                    <Button
                      aria-label={t('common.previous')}
                      disabled={ledgerCursors.length === 1}
                      size="icon-sm"
                      type="button"
                      variant="outline"
                      onClick={() => setLedgerCursors(current =>
                        current.slice(0, -1))}
                    >
                      <IconChevronLeft />
                    </Button>
                    <Button
                      aria-label={t('common.next')}
                      disabled={!ledgerQuery.data.nextCursor}
                      size="icon-sm"
                      type="button"
                      variant="outline"
                      onClick={() => {
                        if (ledgerQuery.data?.nextCursor) {
                          setLedgerCursors(current => [
                            ...current,
                            ledgerQuery.data!.nextCursor,
                          ])
                        }
                      }}
                    >
                      <IconChevronRight />
                    </Button>
                  </div>
                </section>
              )
            : <BillingErrorState retry={() => void ledgerQuery.refetch()} />}
    </div>
  )
}
