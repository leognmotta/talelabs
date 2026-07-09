import { z } from '@hono/zod-openapi'

export const ErrorResponseSchema = z.object({
  error: z.string().openapi({ example: 'Authentication required' }),
}).openapi('ErrorResponse')
