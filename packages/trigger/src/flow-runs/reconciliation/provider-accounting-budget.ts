/** Time- and check-bounded paging for durable provider accounting sweeps. */

/** Counters returned by one claimed provider-accounting page. */
export interface ProviderAccountingPageResult {
  /** Claimed jobs inspected by this page. */
  checked: number
  /** Jobs whose lookup or persistence raised a bounded failure. */
  failed: number
  /** Jobs whose authoritative provider cost was persisted. */
  recovered: number
  /** Jobs with no provider cost available during this attempt. */
  unavailable: number
  /** Exhausted jobs transitioned from pending to explicitly unknown. */
  unknown: number
}

/** Aggregated outcome from one bounded multi-page accounting sweep. */
export interface ProviderAccountingBudgetResult
  extends ProviderAccountingPageResult {
  /** Whether a check or time budget stopped the sweep before a short page. */
  budgetExhausted: boolean
  /** Number of database claim pages attempted, including a final empty page. */
  pages: number
}

/**
 * Processes complete claim pages until no due work remains or a code-owned
 * check/time budget is exhausted. Claimed attempts are always processed before
 * the deadline is evaluated again, so no job consumes an attempt without a
 * corresponding provider lookup or persisted-cost recovery.
 */
export async function runProviderAccountingBudget(input: {
  /** Maximum jobs that may be claimed during this sweep. */
  maxChecks: number
  /** Clock used for the wall-time budget. */
  now?: () => number
  /** Maximum jobs claimed by one transactional database page. */
  pageSize: number
  /** Claims and processes one page no larger than the requested limit. */
  reconcilePage: (limit: number) => Promise<ProviderAccountingPageResult>
  /** Maximum sweep wall time in milliseconds, evaluated between pages. */
  timeBudgetMs: number
}): Promise<ProviderAccountingBudgetResult> {
  if (
    !Number.isInteger(input.maxChecks)
    || input.maxChecks < 1
    || !Number.isInteger(input.pageSize)
    || input.pageSize < 1
    || !Number.isFinite(input.timeBudgetMs)
    || input.timeBudgetMs <= 0
  ) {
    throw new TypeError('provider_accounting_budget_invalid')
  }
  const now = input.now ?? Date.now
  const startedAt = now()
  let drained = false
  let pages = 0
  const totals: ProviderAccountingPageResult = {
    checked: 0,
    failed: 0,
    recovered: 0,
    unavailable: 0,
    unknown: 0,
  }

  while (
    totals.checked < input.maxChecks
    && now() - startedAt < input.timeBudgetMs
  ) {
    const limit = Math.min(
      input.pageSize,
      input.maxChecks - totals.checked,
    )
    const page = await input.reconcilePage(limit)
    if (
      !Number.isInteger(page.checked)
      || page.checked < 0
      || page.checked > limit
    ) {
      throw new Error('provider_accounting_page_size_invalid')
    }
    pages += 1
    totals.checked += page.checked
    totals.failed += page.failed
    totals.recovered += page.recovered
    totals.unavailable += page.unavailable
    totals.unknown += page.unknown
    if (page.checked < limit) {
      drained = true
      break
    }
  }

  return {
    ...totals,
    budgetExhausted: !drained,
    pages,
  }
}
