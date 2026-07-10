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

export const ListQuerySchema = z.object({
  cursor: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  search: z.string().trim().max(200).optional(),
})
