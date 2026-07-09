import { z } from '@hono/zod-openapi'

export const MeResponseSchema = z.object({
  activeOrganizationId: z.string().openapi({
    example: 'org_123',
  }),
  isSystemAdmin: z.boolean().openapi({ example: false }),
  session: z.object({
    createdAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
    id: z.string(),
  }),
  user: z.object({
    email: z.email().openapi({ example: 'mail@leomotta.me' }),
    id: z.string().openapi({ example: 'user_123' }),
    name: z.string().openapi({ example: 'Leonardo Motta' }),
  }),
}).openapi('MeResponse')
