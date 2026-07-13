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
import { useActiveOrganizationId } from '../organizations/organization-scope-context'
import { FlowCanvas } from './flow-canvas'
import {
  useFlowDetailQuery,
  useFlowGraphQuery,
  useFlowReferencesQuery,
  useGenerationConfigQuery,
} from './flow.queries'

export function FlowEditorScreen() {
  const { t } = useTranslation()
  const { flowId } = useParams()
  const organizationId = useActiveOrganizationId()
  const flowQuery = useFlowDetailQuery(flowId ?? null)
  const graphQuery = useFlowGraphQuery(flowId ?? null)
  const referencesQuery = useFlowReferencesQuery(flowId ?? null)
  const configQuery = useGenerationConfigQuery()

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
        {pending
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
