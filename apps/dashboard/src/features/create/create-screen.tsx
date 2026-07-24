/**
 * Loading boundary for new and durable direct Create sessions.
 *
 * Opening or editing this route performs no Flow create, graph read, or graph
 * save. Only the current catalog, account capability, and local draft load.
 */

import { useGetMe } from '@talelabs/sdk'
import { Button } from '@talelabs/ui/components/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@talelabs/ui/components/empty'
import { Spinner } from '@talelabs/ui/components/spinner'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'

import { useSession } from '../auth/auth-client'
import { useGenerationConfigQuery } from '../flows/generation/generation-config.query'
import { useActiveOrganizationId } from '../organizations/organization-scope-context'
import { createEmptyCreateDraft } from './create-draft'
import { readCreateDraftCache } from './create-draft-cache'
import { upgradeCreateDraftModelContract } from './create-resolution'
import { CreateWorkspace } from './create-workspace'
import { useCreateSessionQuery } from './data/create-session.queries'

/** Loads public configuration and restores only same-tab local draft state. */
export function CreateScreen() {
  const { t } = useTranslation()
  const organizationId = useActiveOrganizationId()
  const session = useSession()
  const userId = session.data?.user.id
  const { sessionId: routeSessionId } = useParams<{ sessionId: string }>()
  const createSessionId = routeSessionId ?? null
  const createSessionQuery = useCreateSessionQuery(createSessionId)
  const configQuery = useGenerationConfigQuery()
  const accountQuery = useGetMe()

  if (
    !organizationId
    || !userId
    || configQuery.isPending
    || (createSessionId && createSessionQuery.isPending)
  ) {
    return (
      <div className="flex size-full min-h-0 items-center justify-center">
        <Spinner className="size-6" />
        <span className="sr-only">{t('common.loading')}</span>
      </div>
    )
  }
  const generationConfig = configQuery.data
  if (
    configQuery.isError
    || !generationConfig
    || (createSessionId && createSessionQuery.isError)
  ) {
    return (
      <Empty className="size-full">
        <EmptyHeader>
          <EmptyTitle>{t('create.couldNotLoad')}</EmptyTitle>
          <EmptyDescription>{t('create.couldNotLoadDescription')}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button
            variant="outline"
            onClick={() => {
              void configQuery.refetch()
              if (createSessionId)
                void createSessionQuery.refetch()
            }}
          >
            {t('common.retry')}
          </Button>
        </EmptyContent>
      </Empty>
    )
  }

  const cached = readCreateDraftCache({
    createSessionId,
    organizationId,
    userId,
  })
  const initialDraft = cached
    ? upgradeCreateDraftModelContract(cached)?.draft ?? createEmptyCreateDraft()
    : createEmptyCreateDraft()
  return (
    <CreateWorkspace
      canUseDebugMode={accountQuery.data?.isSystemAdmin === true}
      createSession={createSessionQuery.data ?? null}
      generationConfig={generationConfig}
      initialDraft={initialDraft}
      key={`${organizationId}:${userId}:${createSessionId ?? 'new'}`}
      organizationId={organizationId}
      userId={userId}
    />
  )
}
