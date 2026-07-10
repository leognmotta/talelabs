import { z } from '@hono/zod-openapi'

export const ErrorDetailSchema = z.object({
  code: z.string(),
  field: z.string(),
  message: z.string(),
  params: z.record(
    z.string(),
    z.union([z.string(), z.number(), z.boolean()]),
  ).optional(),
}).openapi('ErrorDetail')

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string().openapi({ example: 'validation_error' }),
    message: z.string().openapi({ example: 'The request could not be validated.' }),
    details: z.array(ErrorDetailSchema).optional(),
  }),
}).openapi('ErrorResponse')

export const ResourceIdSchema = z.string().trim().min(1)
