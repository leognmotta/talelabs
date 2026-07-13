import {
  GENERATION_MODEL_CONTRACTS,
  validateGenerationRegistry,
} from './generation-registry.js'
import { validateFlowNodeRegistry } from './node-registry.js'

export * from './edge-ordering.js'
export * from './generation-evaluator.js'
export * from './generation-registry.js'
export * from './graph-validation.js'
export * from './handles.js'
export * from './limits.js'
export * from './node-registry.js'
export * from './reference-budget.js'
export * from './types.js'

const startupErrors = [
  ...validateFlowNodeRegistry(),
  ...Object.entries(GENERATION_MODEL_CONTRACTS).flatMap(([version, registry]) => (
    validateGenerationRegistry(registry).map(error => `${version}: ${error}`)
  )),
]

if (startupErrors.length) {
  throw new Error(
    `Invalid Flow registry configuration:\n${startupErrors.join('\n')}`,
  )
}
