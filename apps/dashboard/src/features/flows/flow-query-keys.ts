import type { GetFlowsQueryParams } from '@talelabs/sdk'
import { organizationQueryKeys } from '../organizations/organization-query-keys'

function flowScope(organizationId: null | string) {
  return [
    ...organizationQueryKeys.scope(organizationId),
    'flows',
  ] as const
}

export const flowQueryKeys = {
  scope: flowScope,
  lists: (organizationId: null | string) => [
    ...flowScope(organizationId),
    'list',
  ] as const,
  list: (
    organizationId: null | string,
    params: GetFlowsQueryParams,
  ) => [
    ...flowScope(organizationId),
    'list',
    params,
  ] as const,
  details: (organizationId: null | string) => [
    ...flowScope(organizationId),
    'detail',
  ] as const,
  detail: (organizationId: null | string, flowId: null | string) => [
    ...flowScope(organizationId),
    'detail',
    flowId,
  ] as const,
  graph: (organizationId: null | string, flowId: null | string) => [
    ...flowScope(organizationId),
    'graph',
    flowId,
  ] as const,
  allReferences: (organizationId: null | string) => [
    ...flowScope(organizationId),
    'references',
  ] as const,
  references: (organizationId: null | string, flowId: null | string) => [
    ...flowQueryKeys.allReferences(organizationId),
    flowId,
  ] as const,
  generationConfig: (organizationId: null | string) => [
    ...flowScope(organizationId),
    'generation-config',
  ] as const,
  runs: (organizationId: null | string, flowId: null | string) => [
    ...flowScope(organizationId),
    'runs',
    flowId,
  ] as const,
  activeRuns: (organizationId: null | string) => [
    ...flowScope(organizationId),
    'runs',
    'active',
  ] as const,
  run: (organizationId: null | string, runId: null | string) => [
    ...flowScope(organizationId),
    'run',
    runId,
  ] as const,
  runRealtimeToken: (organizationId: null | string, runId: null | string) => [
    ...flowScope(organizationId),
    'run',
    runId,
    'realtime-token',
  ] as const,
}
