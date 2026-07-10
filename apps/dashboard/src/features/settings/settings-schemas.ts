import { z } from 'zod'

export const profileSchema = z.object({
  name: z.string().trim().min(1, { error: 'validation.nameRequired' }),
})

export type ProfileFormValues = z.infer<typeof profileSchema>

export const organizationSettingsSchema = z.object({
  name: z.string().trim().min(1, { error: 'validation.organizationNameRequired' }),
  slug: z.string().trim().min(1, { error: 'validation.organizationSlugRequired' }),
  logo: z.string().trim().url({ error: 'validation.logoUrl' }).or(z.literal('')),
})

export type OrganizationSettingsFormValues = z.infer<typeof organizationSettingsSchema>

export const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, { error: 'validation.passwordCurrentRequired' }),
  newPassword: z.string().min(8, { error: 'validation.passwordMinLength' }),
})

export type UpdatePasswordFormValues = z.infer<typeof updatePasswordSchema>

export const createPasswordSchema = z.object({
  newPassword: z.string().min(8, { error: 'validation.passwordMinLength' }),
})

export type CreatePasswordFormValues = z.infer<typeof createPasswordSchema>

export const teamInvitationSchema = z.object({
  email: z.string().trim().email({ error: 'validation.email' }),
  role: z.enum(['admin', 'member']),
})

export type TeamInvitationFormValues = z.infer<typeof teamInvitationSchema>
