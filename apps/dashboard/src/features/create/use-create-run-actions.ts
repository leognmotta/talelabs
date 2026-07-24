/**
 * Create presentation actions over direct admission and shared run lifecycle.
 *
 * Admission submits one bounded direct request. Cancellation, retry, browser
 * execution, output hydration, and continuation reuse the ordinary run/Asset
 * APIs without creating or saving a Flow.
 */

import type {
  CreateDirectRunRequest,
  FlowRun,
  FlowRunAssetOutput,
  FlowRunSummary,
} from '@talelabs/sdk'
import type { CreateDraft } from './create-draft'

import { listCredentialStatuses } from '@talelabs/providers/browser'
import {
  getAssetsId,
  postRunsCreate,
  postRunsIdCancel,
  postRunsIdRetry,
} from '@talelabs/sdk'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { getApiErrorMessage } from '../../shared/lib/api-error'
import { getOrganizationRequestHeaders } from '../../shared/lib/organization-request'
import { flowQueryKeys } from '../flows/data/query-keys/flow-query-keys'
import {
  publishBrowserRunHint,
  rememberActiveBrowserRun,
} from '../flows/runs/browser-runtime/browser-run-hints'
import {
  createDraftFromRunSummary,
  createDraftUsingAsset,
} from './create-continuation'
import { createSessionQueryKeys } from './data/create-session-query-keys'

/** Binds Create controls to direct admission and existing durable run APIs. */
export function useCreateRunActions(input: {
  /** Current local draft used only for explicit output continuation. */
  draft: CreateDraft
  /** Durable session identity, or null until the first run is admitted. */
  createSessionId: null | string
  /** Opens existing browser credential settings. */
  openSecureStore: () => void
  /** Active tenant owning related runs and Assets. */
  organizationId: string
  /** Current compiled public direct request, or null while invalid. */
  request: CreateDirectRunRequest | null
  /** Replaces only the current browser-local request. */
  replaceDraft: (draft: CreateDraft) => void
  /** Replaces the new route after admission creates its durable session. */
  onSessionCreated: (sessionId: string) => void
  /** Authenticated user used for browser execution recovery. */
  userId: string | undefined
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const {
    draft,
    createSessionId,
    openSecureStore,
    organizationId,
    onSessionCreated,
    request,
    replaceDraft,
    userId,
  } = input

  const observeRun = useCallback((run: FlowRun) => {
    queryClient.setQueryData(flowQueryKeys.run(organizationId, run.id), run)
    void queryClient.invalidateQueries({
      queryKey: flowQueryKeys.createRunLiveHistories(
        organizationId,
        run.createSessionId,
      ),
    })
    void queryClient.invalidateQueries({
      queryKey: createSessionQueryKeys.lists(organizationId),
    })
    void queryClient.invalidateQueries({
      exact: true,
      queryKey: flowQueryKeys.activeRuns(organizationId),
    })
  }, [organizationId, queryClient])

  const rememberBrowserRun = useCallback((run: FlowRun) => {
    if (run.executionRuntime !== 'browser' || !userId)
      return
    rememberActiveBrowserRun(
      queryClient,
      organizationId,
      userId,
      run.id,
    )
    publishBrowserRunHint(
      run.flowId,
      organizationId,
      run.source,
      userId,
      run.id,
    )
  }, [organizationId, queryClient, userId])

  const generate = useCallback(async () => {
    if (!request)
      return null
    try {
      let directRequest = request
      if (
        request.executionMode === 'live'
        && request.executionRuntime === 'browser'
      ) {
        if (!userId) {
          openSecureStore()
          toast.error(t('flows.browserExecution.credential_store_unavailable'))
          return null
        }
        let credentials
        try {
          credentials = await listCredentialStatuses({ userId })
        }
        catch {
          openSecureStore()
          toast.error(t('flows.browserExecution.credential_store_unavailable'))
          return null
        }
        if (credentials.length === 0) {
          openSecureStore()
          toast.error(t('flows.browserExecution.credential_required'))
          return null
        }
        directRequest = {
          ...request,
          byokProviders: credentials.map(status => status.providerId),
        }
      }
      const run = await postRunsCreate(
        {
          data: {
            ...directRequest,
            createSessionId: createSessionId ?? undefined,
          },
        },
        {
          headers: {
            ...getOrganizationRequestHeaders(organizationId),
            'Idempotency-Key': globalThis.crypto.randomUUID(),
          },
        },
      )
      observeRun(run)
      rememberBrowserRun(run)
      if (!createSessionId && run.createSessionId)
        onSessionCreated(run.createSessionId)
      return run
    }
    catch (error) {
      toast.error(getApiErrorMessage(error, 'create.history.generateFailed'))
      return null
    }
  }, [
    observeRun,
    createSessionId,
    openSecureStore,
    organizationId,
    onSessionCreated,
    rememberBrowserRun,
    request,
    t,
    userId,
  ])

  const cancel = useCallback(async (run: FlowRunSummary) => {
    try {
      const response = await postRunsIdCancel(
        { id: run.id },
        { headers: getOrganizationRequestHeaders(organizationId) },
      )
      observeRun(response)
    }
    catch (error) {
      toast.error(getApiErrorMessage(error, 'create.history.cancelFailed'))
    }
  }, [observeRun, organizationId])

  const retry = useCallback(async (run: FlowRunSummary) => {
    try {
      const response = await postRunsIdRetry(
        {
          data: {
            executionMode: run.executionMode,
            executionRuntime: run.executionRuntime,
            expectedRunStatus: run.status,
          },
          id: run.id,
        },
        {
          headers: {
            ...getOrganizationRequestHeaders(organizationId),
            'Idempotency-Key': globalThis.crypto.randomUUID(),
          },
        },
      )
      observeRun(response)
      rememberBrowserRun(response)
    }
    catch (error) {
      toast.error(getApiErrorMessage(error, 'create.history.retryFailed'))
    }
  }, [observeRun, organizationId, rememberBrowserRun])

  const loadAsset = useCallback(
    (assetId: string) => getAssetsId(
      { id: assetId },
      { headers: getOrganizationRequestHeaders(organizationId) },
    ),
    [organizationId],
  )

  const reuseRequest = useCallback(async (run: FlowRunSummary) => {
    const summary = run.requestSummary
    if (!summary) {
      toast.error(t('create.history.requestUnavailable'))
      return
    }
    try {
      const assetIds = [...new Set(summary.inputs.flatMap(slot => slot.assetIds))]
      const assets = await Promise.all(assetIds.map(loadAsset))
      const restored = createDraftFromRunSummary({
        assets: new Map(assets.map(asset => [asset.id, asset])),
        run,
      })
      if (!restored)
        throw new Error('request_summary_incomplete')
      replaceDraft(restored)
      toast.success(t('create.history.requestReused'))
    }
    catch {
      toast.error(t('create.history.requestUnavailable'))
    }
  }, [loadAsset, replaceDraft, t])

  const useOutput = useCallback(async (
    output: FlowRunAssetOutput,
    makeVideo: boolean,
  ) => {
    try {
      const asset = await loadAsset(output.assetId)
      const nextDraft = createDraftUsingAsset({ asset, draft, makeVideo })
      if (!nextDraft)
        throw new Error('result_not_compatible')
      replaceDraft(nextDraft)
      toast.success(t(makeVideo
        ? 'create.results.videoPrepared'
        : 'create.results.referenceAdded'))
    }
    catch {
      toast.error(t('create.results.couldNotReuse'))
    }
  }, [draft, loadAsset, replaceDraft, t])

  return {
    /** Requests cancellation through the shared durable run API. */
    cancel,
    /** Admits exactly one direct request without Flow persistence. */
    generate,
    /** Retries immutable execution state through the shared run API. */
    retry,
    /** Restores bounded historical request facts into local draft state. */
    reuseRequest,
    /** Reuses one canonical output Asset in a compatible next request. */
    useOutput,
  }
}
