/** Admission guard that prevents execution without a complete provider quote. */

import type { PublicRunCostEstimate } from './provider-cost.service.js'

import { HttpError } from '../../middleware/error.js'

/** Rejects admission unless every planned provider job has been estimated. */
export function requireCompleteProviderCostEstimate(
  estimate: PublicRunCostEstimate,
): asserts estimate is Extract<PublicRunCostEstimate, { status: 'estimated' }> {
  if (estimate.status === 'estimated')
    return
  throw new HttpError(
    409,
    'run_cost_estimate_unavailable',
    'A complete provider cost estimate is required before this run can start.',
    [{
      code: 'run_cost_estimate_unavailable',
      field: 'costEstimate',
      message: 'run_cost_estimate_unavailable',
      params: {
        estimatedJobCount: estimate.estimatedJobCount,
        unavailableJobCount: estimate.unavailableJobCount,
      },
    }],
  )
}
