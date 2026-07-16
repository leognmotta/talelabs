import { flowScope } from './flow-query-key-scope'

export function flowAllReferences(organizationId: null | string) {
  return [...flowScope(organizationId), 'references'] as const
}

export function flowReferences(
  organizationId: null | string,
  flowId: null | string,
) {
  return [...flowAllReferences(organizationId), flowId] as const
}

export function flowGenerationConfig(organizationId: null | string) {
  return [...flowScope(organizationId), 'generation-config'] as const
}
