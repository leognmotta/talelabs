import { HttpError } from '../../middleware/error.js'

export function flowRunPlanValidationError(issues: readonly {
  code: string
  field: string
  params?: Record<string, boolean | number | string>
}[]) {
  return new HttpError(
    422,
    'run_plan_invalid',
    'The Flow run could not be planned.',
    issues.map(issue => ({
      code: issue.code,
      field: issue.field,
      message: issue.code,
      params: issue.params,
    })),
  )
}
