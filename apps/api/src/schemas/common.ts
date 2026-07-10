import { z } from '@hono/zod-openapi'

export const ErrorDetailSchema = z.object({
  field: z.string(),
  message: z.string(),
}).openapi('ErrorDetail')

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string().openapi({ example: 'validation_error' }),
    message: z.string().openapi({ example: 'The request could not be validated.' }),
    details: z.array(ErrorDetailSchema).optional(),
  }),
}).openapi('ErrorResponse')

export const ResourceIdSchema = z.string().trim().min(1)
