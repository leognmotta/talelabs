import { ErrorResponseSchema } from '../schemas/common.js'

const errorContent = {
  'application/json': { schema: ErrorResponseSchema },
}

export const commonErrorResponses = {
  400: { description: 'Validation error', content: errorContent },
  401: { description: 'Authentication required', content: errorContent },
  403: { description: 'Active organization required', content: errorContent },
  404: { description: 'Resource not found', content: errorContent },
  409: { description: 'Resource state conflict', content: errorContent },
  429: { description: 'Organization request rate limit exceeded', content: errorContent },
  500: { description: 'Internal server error', content: errorContent },
} as const
