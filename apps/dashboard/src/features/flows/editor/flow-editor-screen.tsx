/** Flow editor route screen and server-state loading boundary. */

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
import { Navigate, useParams } from 'react-router'
import { useStore } from 'zustand'
import { useActiveOrganizationId } from '../../organizations/organization-scope-context'
import {
  useFlowDetailQuery,
  useFlowGraphQuery,
  useFlowReferencesQuery,
} from '../data/flow-detail.queries'
import { useGenerationConfigQuery } from '../generation/generation-config.query'
import { FlowCanvas } from './flow-canvas'
import {
  createFlowBackgroundSaveKey,
  flowBackgroundSaveStore,
} from './persistence/flow-background-save-store'

/** Loads a Flow editor route and supplies canvas data plus system privileges. */
export function FlowEditorScreen() {
  const { t } = useTranslation()
  const { flowId } = useParams()
  const organizationId = useActiveOrganizationId()
  const flowQuery = useFlowDetailQuery(flowId ?? null)
  const graphQuery = useFlowGraphQuery(flowId ?? null)
  const referencesQuery = useFlowReferencesQuery(flowId ?? null)
  const configQuery = useGenerationConfigQuery()
  const accountQuery = useGetMe()
  const backgroundSaveKey = flowId && organizationId
    ? createFlowBackgroundSaveKey(organizationId, flowId)
    : null
  const backgroundSaving = useStore(
    flowBackgroundSaveStore,
    state => backgroundSaveKey !== null
      && state.pendingKeys.has(backgroundSaveKey),
  )

  if (!flowId)
    return <Navigate replace to="/flows" />

  const pending = flowQuery.isPending || graphQuery.isPending
    || referencesQuery.isPending || configQuery.isPending
  const failed = flowQuery.isError || graphQuery.isError
    || referencesQuery.isError || configQuery.isError
  const flow = flowQuery.data
  const graph = graphQuery.data
  const references = referencesQuery.data
  const generationConfig = configQuery.data

  return (
    <section className="min-h-0 flex-1">
      <div className="size-full min-h-0">
        {pending || backgroundSaving
          ? (
              <div className="
                flex size-full items-center justify-center bg-card
              "
              >
                <Spinner className="size-6" />
                <span className="sr-only">{t('common.loading')}</span>
              </div>
            )
          : failed || !flow || !graph || !references || !generationConfig
            || !organizationId
            ? (
                <Empty className="size-full bg-card">
                  <EmptyHeader>
                    <EmptyTitle>{t('flows.couldNotLoad')}</EmptyTitle>
                    <EmptyDescription>{t('flows.couldNotLoadDescription')}</EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button
                      variant="outline"
                      onClick={() => {
                        void flowQuery.refetch()
                        void graphQuery.refetch()
                        void referencesQuery.refetch()
                        void configQuery.refetch()
                      }}
                    >
                      {t('common.retry')}
                    </Button>
                  </EmptyContent>
                </Empty>
              )
            : (
                <FlowCanvas
                  canUseDebugMode={accountQuery.data?.isSystemAdmin === true}
                  key={`${organizationId}:${flow.id}`}
                  flow={flow}
                  generationConfig={generationConfig}
                  graph={graph}
                  organizationId={organizationId}
                  references={references}
                />
              )}
      </div>
    </section>
  )
}
