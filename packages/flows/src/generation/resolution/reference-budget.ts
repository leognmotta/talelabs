import { FLOW_GRAPH_LIMITS } from '../../graph/limits.js'

export interface FlowReferenceBudget {
  assets: number
  elementAssets: number
}

export interface FlowReferenceBudgetViolation {
  actual: number
  field: keyof FlowReferenceBudget
  maximum: number
}

export function getFlowReferenceBudgetViolation(
  budget: FlowReferenceBudget,
): FlowReferenceBudgetViolation | null {
  if (budget.elementAssets > FLOW_GRAPH_LIMITS.referenceLinks) {
    return {
      actual: budget.elementAssets,
      field: 'elementAssets',
      maximum: FLOW_GRAPH_LIMITS.referenceLinks,
    }
  }
  if (budget.assets > FLOW_GRAPH_LIMITS.referenceAssets) {
    return {
      actual: budget.assets,
      field: 'assets',
      maximum: FLOW_GRAPH_LIMITS.referenceAssets,
    }
  }
  return null
}
