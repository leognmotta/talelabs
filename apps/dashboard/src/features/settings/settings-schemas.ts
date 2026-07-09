import { z } from 'zod'

export const profileSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.'),
})

export type ProfileFormValues = z.infer<typeof profileSchema>

export const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required.'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters.'),
})

export type UpdatePasswordFormValues = z.infer<typeof updatePasswordSchema>

export const createPasswordSchema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters.'),
})

export type CreatePasswordFormValues = z.infer<typeof createPasswordSchema>

export const teamInvitationSchema = z.object({
  email: z.string().trim().email('Enter a valid email.'),
  role: z.enum(['admin', 'member']),
})

export type TeamInvitationFormValues = z.infer<typeof teamInvitationSchema>
