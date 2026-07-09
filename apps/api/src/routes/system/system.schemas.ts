import { z } from '@hono/zod-openapi'

export const HealthResponseSchema = z.object({
  ok: z.boolean().openapi({ example: true }),
}).openapi('HealthResponse')
