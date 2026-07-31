/** Cursor-paged monthly generation history for the Billing Usage destination. */

import type { BillingUsageRun } from '@talelabs/sdk'
import type { ComponentProps } from 'react'

import { Badge } from '@talelabs/ui/components/badge'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@talelabs/ui/components/pagination'
import { Skeleton } from '@talelabs/ui/components/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@talelabs/ui/components/table'
import { cn } from '@talelabs/ui/lib/utils'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { formatCredits } from './billing-format'
import { useBillingUsageRunsQuery } from './billing-queries'
import { BillingErrorState } from './billing-state-panel'

const statusTranslationKeys = {
  canceled: 'create.runStatus.canceled',
  failed: 'create.runStatus.failed',
  partial: 'create.runStatus.partial',
  pending: 'create.runStatus.pending',
  running: 'create.runStatus.running',
  succeeded: 'create.runStatus.succeeded',
} as const satisfies Record<
  BillingUsageRun['status'],
  `create.runStatus.${BillingUsageRun['status']}`
>

function statusBadgeVariant(
  status: BillingUsageRun['status'],
): ComponentProps<typeof Badge>['variant'] {
  if (status === 'failed')
    return 'destructive'
  if (status === 'succeeded')
    return 'secondary'
  if (status === 'partial' || status === 'canceled')
    return 'outline'
  return 'default'
}

function visibleCreditCost(run: BillingUsageRun) {
  if (run.fundingSource === 'byok')
    return null
  if (run.creditCost !== null)
    return run.creditCost
  if (run.status === 'pending' || run.status === 'running')
    return run.creditQuoted
  return 0
}

/** Renders one selected month's visible Flow and private Create run history. */
export function BillingRunHistoryTable({
  month,
  organizationId,
}: {
  /** Selected UTC billing month encoded as YYYY-MM. */
  month: string
  /** Active organization identity used only in organization-keyed queries. */
  organizationId: null | string
}) {
  const { i18n, t } = useTranslation()
  const [cursors, setCursors] = useState<(null | string)[]>([null])
  const cursor = cursors.at(-1) ?? null
  const query = useBillingUsageRunsQuery(organizationId, month, cursor)
  const previousDisabled = cursors.length === 1 || query.isFetching
  const nextDisabled = !query.data?.nextCursor || query.isFetching
  const dateTimeFormatter = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  return (
    <section
      aria-labelledby="billing-run-history-title"
      className="flex flex-col gap-3"
    >
      <div>
        <h3 className="font-medium" id="billing-run-history-title">
          {t('billing.runHistory')}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t('billing.runHistoryDescription')}
        </p>
      </div>
      {query.isPending
        ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-10 w-full rounded-2xl" />
              <Skeleton className="h-12 w-full rounded-2xl" />
              <Skeleton className="h-12 w-full rounded-2xl" />
            </div>
          )
        : query.isError || !query.data
          ? <BillingErrorState retry={() => void query.refetch()} />
          : (
              <>
                <Table className="table-fixed">
                  <colgroup>
                    <col />
                    <col className="w-28" />
                    <col className="w-24" />
                    <col className="w-20" />
                  </colgroup>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pr-2 pl-0">
                        {t('billing.runs')}
                      </TableHead>
                      <TableHead className="
                        overflow-hidden px-2 text-xs text-ellipsis
                      "
                      >
                        {t('billing.status')}
                      </TableHead>
                      <TableHead className="
                        overflow-hidden px-2 text-right text-xs text-ellipsis
                      "
                      >
                        {t('billing.outputs')}
                      </TableHead>
                      <TableHead className="
                        overflow-hidden pr-0 pl-2 text-right text-xs
                        text-ellipsis
                      "
                      >
                        {t('billing.credits')}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {query.data.items.length === 0
                      ? (
                          <TableRow>
                            <TableCell
                              className="h-28 text-center text-muted-foreground"
                              colSpan={4}
                            >
                              {t('billing.noRuns')}
                            </TableCell>
                          </TableRow>
                        )
                      : query.data.items.map((run) => {
                          const credits = visibleCreditCost(run)
                          const sourceName = run.sourceName ?? (
                            run.source === 'create'
                              ? t('create.sessions.untitled')
                              : t('navigation.flows')
                          )
                          const source = run.source === 'create'
                            ? t('navigation.create')
                            : t('navigation.flows')
                          const media = run.mediaTypes.length > 0
                            ? run.mediaTypes.map(mediaType =>
                                t(`billing.mediaTypes.${mediaType}`),
                              ).join(', ')
                            : '—'
                          return (
                            <TableRow key={run.id}>
                              <TableCell className="
                                overflow-hidden py-3 pr-2 pl-0 whitespace-normal
                              "
                              >
                                <p className="truncate font-medium">
                                  {sourceName}
                                </p>
                                <p className="
                                  flex min-w-0 items-center gap-1 text-xs
                                  text-muted-foreground
                                "
                                >
                                  <span className="shrink-0">{source}</span>
                                  <span aria-hidden="true">·</span>
                                  <span className="truncate">{media}</span>
                                </p>
                                <p className="
                                  truncate text-xs text-muted-foreground
                                "
                                >
                                  {dateTimeFormatter.format(
                                    new Date(run.createdAt),
                                  )}
                                </p>
                              </TableCell>
                              <TableCell className="overflow-hidden px-2">
                                <Badge
                                  className="max-w-full truncate"
                                  variant={statusBadgeVariant(run.status)}
                                >
                                  {t(statusTranslationKeys[run.status])}
                                </Badge>
                              </TableCell>
                              <TableCell className="
                                overflow-hidden px-2 text-right tabular-nums
                              "
                              >
                                {new Intl.NumberFormat(i18n.language).format(
                                  run.outputCount,
                                )}
                              </TableCell>
                              <TableCell className="
                                overflow-hidden pr-0 pl-2 text-right
                                tabular-nums
                              "
                              >
                                {run.fundingSource === 'byok'
                                  ? t('secureStore.byok')
                                  : formatCredits(
                                      credits ?? 0,
                                      i18n.language,
                                    )}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                  </TableBody>
                </Table>
                {(cursors.length > 1 || query.data.nextCursor) && (
                  <Pagination
                    aria-label={t('billing.runHistoryPagination')}
                    className="justify-end"
                  >
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          aria-disabled={previousDisabled}
                          aria-label={t('common.previous')}
                          className={cn(
                            previousDisabled
                            && 'pointer-events-none opacity-50',
                          )}
                          href="#"
                          tabIndex={previousDisabled ? -1 : undefined}
                          text={t('common.previous')}
                          onClick={(event) => {
                            event.preventDefault()
                            if (!previousDisabled) {
                              setCursors(current =>
                                current.slice(0, -1))
                            }
                          }}
                        />
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationNext
                          aria-disabled={nextDisabled}
                          aria-label={t('common.next')}
                          className={cn(
                            nextDisabled
                            && 'pointer-events-none opacity-50',
                          )}
                          href="#"
                          tabIndex={nextDisabled ? -1 : undefined}
                          text={t('common.next')}
                          onClick={(event) => {
                            event.preventDefault()
                            if (!nextDisabled && query.data.nextCursor) {
                              const nextCursor = query.data.nextCursor
                              setCursors(current => [
                                ...current,
                                nextCursor,
                              ])
                            }
                          }}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                )}
              </>
            )}
    </section>
  )
}
