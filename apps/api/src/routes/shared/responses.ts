import { ErrorResponseSchema } from '../../schemas/common.js'

const errorContent = {
  'application/json': { schema: ErrorResponseSchema },
} as const

export const organizationErrorResponses = {
  401: {
    content: errorContent,
    description: 'Authentication required',
  },
  403: {
    content: errorContent,
    description: 'Active organization required',
  },
} as const

export const validationErrorResponse = {
  content: errorContent,
  description: 'Validation error',
} as const

export function notFoundErrorResponse(resource: string) {
  return {
    content: errorContent,
    description: `${resource} not found`,
  } as const
}
