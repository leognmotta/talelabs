import { z } from '@hono/zod-openapi'

export const OrganizationSchema = z.object({
  id: z.string().openapi({ example: 'org_123' }),
  name: z.string().openapi({ example: 'Acme Inc' }),
  slug: z.string().openapi({ example: 'acme-inc' }),
  logo: z.string().nullable().openapi({ example: null }),
  role: z.string().nullable().openapi({ example: 'admin' }),
  isSystemAdminAccess: z.boolean().openapi({ example: false }),
}).openapi('Organization')

export const InvitationSchema = z.object({
  id: z.string().openapi({ example: 'invite_123' }),
  organizationId: z.string().openapi({ example: 'org_123' }),
  email: z.email().openapi({ example: 'new-user@example.com' }),
  role: z.enum(['admin', 'member']).openapi({ example: 'member' }),
  status: z.string().openapi({ example: 'pending' }),
  expiresAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
  inviteUrl: z.url().openapi({
    example: 'http://localhost:5173/accept-invitation?token=invite_123',
  }),
}).openapi('Invitation')

export const OrganizationMemberSchema = z.object({
  id: z.string().openapi({ example: 'member_123' }),
  organizationId: z.string().openapi({ example: 'org_123' }),
  userId: z.string().openapi({ example: 'user_123' }),
  name: z.string().openapi({ example: 'Ada Lovelace' }),
  email: z.email().openapi({ example: 'ada@example.com' }),
  role: z.enum(['admin', 'member']).openapi({ example: 'member' }),
  createdAt: z.iso.datetime(),
}).openapi('OrganizationMember')

export const ListOrganizationsResponseSchema = z.object({
  organizations: z.array(OrganizationSchema),
}).openapi('ListOrganizationsResponse')

export const ActivateOrganizationResponseSchema = z.object({
  organization: OrganizationSchema,
}).openapi('ActivateOrganizationResponse')

export const ListInvitationsResponseSchema = z.object({
  invitations: z.array(InvitationSchema),
}).openapi('ListInvitationsResponse')

export const ListOrganizationMembersResponseSchema = z.object({
  members: z.array(OrganizationMemberSchema),
}).openapi('ListOrganizationMembersResponse')

export const CreateInvitationRequestSchema = z.object({
  email: z.email().openapi({ example: 'new-user@example.com' }),
  role: z.enum(['admin', 'member']).default('member').openapi({ example: 'member' }),
  resend: z.boolean().optional().openapi({ example: false }),
}).openapi('CreateInvitationRequest')

export const CreateInvitationResponseSchema = z.object({
  invitation: InvitationSchema,
}).openapi('CreateInvitationResponse')

export const RevokeInvitationResponseSchema = z.object({
  invitation: InvitationSchema,
}).openapi('RevokeInvitationResponse')
