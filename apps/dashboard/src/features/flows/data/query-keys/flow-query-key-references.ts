/** Query keys for hydrated graph references and public generation configuration. */

import { flowScope } from './flow-query-key-scope'

/** Prefix matching reference snapshots for every Flow in the organization. */
export function flowAllReferences(organizationId: null | string) {
  return [...flowScope(organizationId), 'references'] as const
}

/** Key for the canonical Asset reference snapshot of one Flow. */
export function flowReferences(
  organizationId: null | string,
  flowId: null | string,
) {
  return [...flowAllReferences(organizationId), flowId] as const
}

/** Key for the sanitized generation catalog projection available to the editor. */
export function flowGenerationConfig(organizationId: null | string) {
  return [...flowScope(organizationId), 'generation-config'] as const
}
