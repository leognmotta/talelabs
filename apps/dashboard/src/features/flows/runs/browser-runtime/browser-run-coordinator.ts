/** Fair fenced scheduling and recovery for browser-owned durable run jobs. */

import type { PutRunsIdBrowserExecutorStatusMutationRequest } from '@talelabs/sdk'
import type { QueryClient } from '@tanstack/react-query'
import type { BrowserLeasedRunScope } from './browser-runtime-api'

import type { BrowserExecutorFailure } from './browser-runtime-errors'
import { listCredentialStatuses } from '@talelabs/providers/browser'

import PQueue from 'p-queue'
import { flowQueryKeys } from '../../data/query-keys/flow-query-keys'
import { executeBrowserCancellation } from './browser-cancellation-executor'
import { executeBrowserJob } from './browser-job-executor'
import {
  dischargeBrowserRunHint,
  forgetActiveBrowserRun,
  readPendingBrowserRunHints,
  rememberActiveBrowserRun,
} from './browser-run-hints'
import {
  clearBrowserRunJournal,
  readBrowserRunJournal,
  writeBrowserRunJournal,
} from './browser-run-journal'
import {
  acquireBrowserLease,
  claimBrowserJobs,
  getBrowserManifest,
  getBrowserRun,
  listActiveBrowserRuns,
  releaseBrowserLease,
  updateBrowserExecutorStatus,
} from './browser-runtime-api'
import {
  classifyBrowserExecutorFailure,
  isBrowserRunTerminalError,
} from './browser-runtime-errors'

const BROWSER_JOB_CONCURRENCY = 2
const BROWSER_QUEUE_FILL_LIMIT = BROWSER_JOB_CONCURRENCY * 2
const BROWSER_DISCOVERY_REFRESH_MS = 60_000
const BROWSER_ERROR_RETRY_MS = 15_000
const BROWSER_LEASE_RENEWAL_SAFETY_MS = 15_000
const BROWSER_MINIMUM_REFRESH_MS = 1_000

interface BrowserCoordinatorLease extends BrowserLeasedRunScope {
  /** Authoritative server expiry used only to schedule the next renewal. */
  leaseExpiresAt: string
}

/** Coordinates browser work while PostgreSQL owns lifecycle and lease facts. */
export class BrowserRunCoordinator {
  readonly #queue = new PQueue({ concurrency: BROWSER_JOB_CONCURRENCY })
  readonly #inFlightJobs = new Set<string>()
  readonly #leases = new Map<string, BrowserCoordinatorLease>()
  readonly #credentialBlockedRunIds = new Set<string>()
  readonly #readyRunIds = new Set<string>()
  #roundRobinOffset = 0
  #resolveRefresh: (() => void) | null = null
  #wakeRequested = false
  readonly #input: {
    channel: BroadcastChannel
    executorId: string
    onFailure: (failure: BrowserExecutorFailure) => void
    organizationId: string
    queryClient: QueryClient
    signal: AbortSignal
    userId: string
  }

  constructor(input: {
    channel: BroadcastChannel
    executorId: string
    onFailure: (failure: BrowserExecutorFailure) => void
    organizationId: string
    queryClient: QueryClient
    signal: AbortSignal
    userId: string
  }) {
    this.#input = input
  }

  async #persistStatus(
    runId: string,
    state: PutRunsIdBrowserExecutorStatusMutationRequest,
  ) {
    await updateBrowserExecutorStatus(this.#input.organizationId, runId, state)
  }

  async #reportRunFailure(runId: string, error: unknown) {
    const failure = classifyBrowserExecutorFailure(error)
    if (!failure)
      return
    this.#readyRunIds.delete(runId)
    this.#input.onFailure(failure)
    if (failure.code === 'browser_run_not_found') {
      await this.#forgetRun(runId)
      return
    }
    await this.#persistStatus(runId, failure).catch(() => undefined)
  }

  async #activeRunIds() {
    const [activeRunIds, checkpoints] = await Promise.all([
      this.#input.queryClient.fetchQuery({
        queryFn: () => listActiveBrowserRuns(this.#input.organizationId),
        queryKey: flowQueryKeys.activeBrowserRuns(
          this.#input.organizationId,
          this.#input.userId,
        ),
        staleTime: BROWSER_DISCOVERY_REFRESH_MS,
      }),
      readBrowserRunJournal(this.#input.organizationId, this.#input.userId),
    ])
    const activeRunIdSet = new Set(activeRunIds)
    // Admission hints survive an overwriting in-flight discovery response;
    // each one is verified against authoritative run state until the server
    // either lists the run or confirms it terminal.
    const hintedRunIds = readPendingBrowserRunHints(
      this.#input.organizationId,
      this.#input.userId,
    )
    for (const runId of hintedRunIds) {
      if (activeRunIdSet.has(runId)) {
        dischargeBrowserRunHint(
          this.#input.organizationId,
          this.#input.userId,
          runId,
        )
      }
    }
    const recoveryRunIds = [
      ...new Set([
        ...checkpoints.map(checkpoint => checkpoint.runId),
        ...hintedRunIds,
      ]),
    ]
    await Promise.all(
      recoveryRunIds.map(async (runId) => {
        if (activeRunIdSet.has(runId))
          return
        try {
          const run = await getBrowserRun(this.#input.organizationId, runId)
          const cancellationPending
            = run.status === 'canceled'
              && run.browserExecution?.status === 'canceling'
          if (
            run.executionRuntime === 'browser'
            && (['pending', 'running'].includes(run.status) || cancellationPending)
          ) {
            activeRunIdSet.add(runId)
            rememberActiveBrowserRun(
              this.#input.queryClient,
              this.#input.organizationId,
              this.#input.userId,
              runId,
            )
          }
          else {
            await this.#forgetRun(runId)
          }
        }
        catch (error) {
          const failure = classifyBrowserExecutorFailure(error)
          if (failure?.code === 'browser_run_not_found') {
            await this.#forgetRun(runId)
          }
          else {
            activeRunIdSet.add(runId)
            await this.#reportRunFailure(runId, error)
          }
        }
      }),
    )
    return [...activeRunIdSet].toSorted()
  }

  async #release(scope: BrowserLeasedRunScope) {
    await releaseBrowserLease(scope)
    this.#leases.delete(scope.runId)
    this.#readyRunIds.delete(scope.runId)
  }

  async #forgetRun(runId: string) {
    await clearBrowserRunJournal(runId).catch(() => undefined)
    this.#leases.delete(runId)
    this.#readyRunIds.delete(runId)
    this.#credentialBlockedRunIds.delete(runId)
    forgetActiveBrowserRun(
      this.#input.queryClient,
      this.#input.organizationId,
      this.#input.userId,
      runId,
    )
    await this.#input.queryClient.invalidateQueries({
      queryKey: flowQueryKeys.run(this.#input.organizationId, runId),
    })
  }

  async #reconcileCancellations(
    scope: BrowserLeasedRunScope,
    manifest: Awaited<ReturnType<typeof getBrowserManifest>>,
  ) {
    for (const cancellation of manifest.cancellations) {
      await writeBrowserRunJournal({
        executorId: scope.executorId,
        jobId: cancellation.jobId,
        nextEligibleAt: null,
        organizationId: scope.organizationId,
        outputIndex: null,
        phase: 'cancellation',
        providerJobId: cancellation.providerJobId,
        runId: scope.runId,
        updatedAt: new Date().toISOString(),
        userId: this.#input.userId,
      })
      await executeBrowserCancellation({
        cancellation,
        scope,
        signal: this.#input.signal,
        userId: this.#input.userId,
      })
    }
    await clearBrowserRunJournal(scope.runId)
    await this.#release(scope)
    await this.#forgetRun(scope.runId)
  }

  async #requireLiveCredential(scope: BrowserLeasedRunScope) {
    let statuses
    try {
      statuses = await listCredentialStatuses({ userId: this.#input.userId })
    }
    catch {
      throw Object.assign(new Error('credential_store_unavailable'), {
        browserExecutorCode: 'credential_store_unavailable',
      })
    }
    if (statuses.some(status => status.providerId === 'openrouter'))
      return
    await writeBrowserRunJournal({
      executorId: scope.executorId,
      jobId: null,
      nextEligibleAt: null,
      organizationId: scope.organizationId,
      outputIndex: null,
      phase: 'credential-required',
      providerJobId: null,
      runId: scope.runId,
      updatedAt: new Date().toISOString(),
      userId: this.#input.userId,
    })
    throw Object.assign(new Error('credential_required'), {
      browserExecutorCode: 'credential_required',
    })
  }

  async #syncRun(runId: string) {
    if (this.#credentialBlockedRunIds.has(runId))
      return
    const acquired = await acquireBrowserLease({
      executorId: this.#input.executorId,
      organizationId: this.#input.organizationId,
      runId,
    })
    const scope: BrowserCoordinatorLease = {
      executorId: acquired.executorId,
      fenceToken: acquired.fenceToken,
      leaseExpiresAt: acquired.leaseExpiresAt,
      organizationId: this.#input.organizationId,
      runId,
    }
    this.#leases.set(runId, scope)
    const manifest = await getBrowserManifest(scope)
    if (manifest.run.status === 'canceled') {
      await this.#reconcileCancellations(scope, manifest)
      return
    }
    if (!['pending', 'running'].includes(manifest.run.status)) {
      await this.#release(scope)
      await this.#forgetRun(runId)
      return
    }
    try {
      await writeBrowserRunJournal({
        executorId: this.#input.executorId,
        jobId: null,
        nextEligibleAt: null,
        organizationId: this.#input.organizationId,
        outputIndex: null,
        phase: 'discovering',
        providerJobId: null,
        runId,
        updatedAt: new Date().toISOString(),
        userId: this.#input.userId,
      })
    }
    catch (cause) {
      throw Object.assign(new Error('browser_journal_unavailable', { cause }), {
        browserExecutorCode: 'browser_journal_unavailable',
      })
    }
    if (manifest.run.executionMode === 'live')
      await this.#requireLiveCredential(scope)
    if (!this.#readyRunIds.has(runId)) {
      await this.#persistStatus(runId, { code: null, status: 'ready' })
      this.#readyRunIds.add(runId)
    }
    const capacity
      = BROWSER_QUEUE_FILL_LIMIT - this.#queue.size - this.#queue.pending
    if (capacity <= 0)
      return
    const claimed = await claimBrowserJobs(scope, {
      activeJobIds: [...this.#inFlightJobs],
      limit: Math.min(capacity, 1),
    })
    await this.#input.queryClient.invalidateQueries({
      queryKey: flowQueryKeys.run(this.#input.organizationId, runId),
    })
    for (const job of claimed.jobs) {
      if (this.#inFlightJobs.has(job.job.id))
        continue
      this.#inFlightJobs.add(job.job.id)
      void this.#queue
        .add(async () => {
          try {
            await executeBrowserJob(job, {
              ...scope,
              signal: this.#input.signal,
              userId: this.#input.userId,
            })
          }
          finally {
            this.#inFlightJobs.delete(job.job.id)
            await this.#input.queryClient.invalidateQueries({
              queryKey: flowQueryKeys.run(this.#input.organizationId, runId),
            })
            this.#input.channel.postMessage({ runId, type: 'run-changed' })
            this.wake()
          }
        })
        .catch(error => this.#reportRunFailure(runId, error))
    }
  }

  #nextDiscoveryRefreshMs() {
    const state = this.#input.queryClient.getQueryState(
      flowQueryKeys.activeBrowserRuns(
        this.#input.organizationId,
        this.#input.userId,
      ),
    )
    if (!state?.dataUpdatedAt)
      return BROWSER_MINIMUM_REFRESH_MS
    return Math.max(
      BROWSER_MINIMUM_REFRESH_MS,
      BROWSER_DISCOVERY_REFRESH_MS - (Date.now() - state.dataUpdatedAt),
    )
  }

  #nextRefreshMs(hasActiveRuns: boolean, discoveryFailed = false) {
    const discoveryRefreshMs = discoveryFailed
      ? BROWSER_ERROR_RETRY_MS
      : this.#nextDiscoveryRefreshMs()
    if (!hasActiveRuns)
      return discoveryRefreshMs
    const renewalTimes = [...this.#leases.values()].map(
      scope =>
        new Date(scope.leaseExpiresAt).getTime()
          - Date.now()
          - BROWSER_LEASE_RENEWAL_SAFETY_MS,
    )
    if (renewalTimes.length === 0)
      return Math.min(discoveryRefreshMs, BROWSER_ERROR_RETRY_MS)
    return Math.max(
      BROWSER_MINIMUM_REFRESH_MS,
      Math.min(discoveryRefreshMs, ...renewalTimes),
    )
  }

  async #waitForRefresh(refreshMs: null | number) {
    if (this.#wakeRequested) {
      this.#wakeRequested = false
      return
    }
    await new Promise<void>((resolve) => {
      let timeout: null | number = null
      const finish = () => {
        if (timeout !== null)
          window.clearTimeout(timeout)
        this.#input.signal.removeEventListener('abort', finish)
        if (this.#resolveRefresh === finish)
          this.#resolveRefresh = null
        resolve()
      }
      this.#resolveRefresh = finish
      if (refreshMs !== null)
        timeout = window.setTimeout(finish, refreshMs)
      if (this.#input.signal.aborted)
        finish()
      else this.#input.signal.addEventListener('abort', finish, { once: true })
    })
  }

  /** Interrupts recovery waiting after a local or cross-tab state-change hint. */
  wake() {
    if (this.#resolveRefresh) {
      const resolve = this.#resolveRefresh
      this.#resolveRefresh = null
      resolve()
      return
    }
    this.#wakeRequested = true
  }

  /** Reports whether focus or reconnect should resume known browser work. */
  hasActiveWork() {
    const activeRunIds = this.#input.queryClient.getQueryData<string[]>(
      flowQueryKeys.activeBrowserRuns(
        this.#input.organizationId,
        this.#input.userId,
      ),
    )
    return (
      this.#leases.size > 0
      || Boolean(activeRunIds?.length)
      || readPendingBrowserRunHints(this.#input.organizationId, this.#input.userId)
        .length > 0
    )
  }

  /** Runs until layout unmount, preserving fair round-robin queue filling. */
  async run() {
    try {
      while (!this.#input.signal.aborted) {
        let ids: string[] = []
        try {
          ids = await this.#activeRunIds()
        }
        catch (error) {
          const failure = classifyBrowserExecutorFailure(error)
          if (failure)
            this.#input.onFailure(failure)
          await this.#waitForRefresh(
            this.#nextRefreshMs(this.#leases.size > 0, true),
          )
          continue
        }
        const ordered
          = ids.length === 0
            ? []
            : [
                ...ids.slice(this.#roundRobinOffset),
                ...ids.slice(0, this.#roundRobinOffset),
              ]
        for (const runId of ordered) {
          if (this.#input.signal.aborted)
            break
          try {
            await this.#syncRun(runId)
          }
          catch (error) {
            if (isBrowserRunTerminalError(error)) {
              await this.#forgetRun(runId)
              continue
            }
            const failure = classifyBrowserExecutorFailure(error)
            if (failure?.status === 'blocked')
              this.#credentialBlockedRunIds.add(runId)
            await this.#reportRunFailure(runId, error)
            const scope = this.#leases.get(runId)
            if (scope)
              await this.#release(scope).catch(() => undefined)
          }
        }
        if (ids.length > 0)
          this.#roundRobinOffset = (this.#roundRobinOffset + 1) % ids.length
        await this.#waitForRefresh(this.#nextRefreshMs(ids.length > 0))
      }
    }
    finally {
      this.#queue.pause()
      this.#queue.clear()
      await Promise.allSettled(
        [...this.#leases.values()].map(releaseBrowserLease),
      )
      this.#leases.clear()
    }
  }
}
