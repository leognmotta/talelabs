import { z } from '@hono/zod-openapi'
import { supportedLocales } from '@talelabs/i18n'

export const AccountLocaleSchema = z.enum(supportedLocales).nullable().openapi({
  example: 'pt-BR',
})

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
    locale: AccountLocaleSchema,
    name: z.string().openapi({ example: 'Leonardo Motta' }),
  }),
}).openapi('MeResponse')

export const UpdateAccountPreferencesRequestSchema = z.object({
  locale: AccountLocaleSchema,
}).openapi('UpdateAccountPreferencesRequest')

export const UpdateAccountPreferencesResponseSchema = z.object({
  locale: AccountLocaleSchema,
}).openapi('UpdateAccountPreferencesResponse')

export const SetPasswordRequestSchema = z.object({
  newPassword: z.string().min(8).openapi({
    example: 'correct horse battery staple',
  }),
}).openapi('SetPasswordRequest')

export const SetPasswordResponseSchema = z.object({
  status: z.literal(true),
}).openapi('SetPasswordResponse')
