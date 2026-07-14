import type { FlowReferenceBudgetViolation } from '@talelabs/flows'
import type { FlowReferenceBudgetExecutor } from '../data/flow-reference-budget.data.js'

import { getFlowReferenceBudgetViolation } from '@talelabs/flows'

import {
  getFlowReferenceBudget,
} from '../data/flow-reference-budget.data.js'
import { HttpError } from '../middleware/error.js'

export function createFlowReferenceBudgetError(
  violation: FlowReferenceBudgetViolation & { flowId?: string },
) {
  return new HttpError(
    400,
    'validation_error',
    'The Flow reference budget would be exceeded.',
    [{
      code: 'reference_hydration_limit',
      field: violation.field,
      message: 'reference_hydration_limit',
      params: {
        actual: violation.actual,
        maximum: violation.maximum,
        ...(violation.flowId ? { flowId: violation.flowId } : {}),
      },
    }],
  )
}

export async function assertFlowReferenceBudget(
  executor: FlowReferenceBudgetExecutor,
  input: {
    assetIds: readonly string[]
    elementIds: readonly string[]
    organizationId: string
  },
) {
  const budget = await getFlowReferenceBudget(executor, input)
  const violation = getFlowReferenceBudgetViolation(budget)
  if (violation)
    throw createFlowReferenceBudgetError(violation)
}

export async function assertElementFlowReferenceBudgets(
  _executor: FlowReferenceBudgetExecutor,
  _input: {
    elementId: string
    organizationId: string
  },
) {
  // Compatibility seam for the dormant Element API. Elements no longer
  // participate in Flow graphs, so changing an Element cannot affect a Flow
  // reference budget.
  return Promise.resolve()
}
