import type { UserInvitationEmailProps } from './templates/user-invitation.js'

import process from 'node:process'

import { getResendClient } from './client.js'
import { UserInvitationEmail } from './templates/user-invitation.js'

const DEFAULT_FROM_ADDRESS = 'TaleLabs <leo@tryconnecto.com>'

export interface SendUserInvitationEmailInput extends UserInvitationEmailProps {
  invitationId: string
}

export class EmailDeliveryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EmailDeliveryError'
  }
}

function createInvitationText({
  expiresAt,
  invitationUrl,
  invitedEmail,
  inviterName,
  organizationName,
  productName = 'TaleLabs',
  role,
}: UserInvitationEmailProps) {
  return [
    `${inviterName} invited ${invitedEmail} to join ${organizationName} on ${productName} as an organization ${role}.`,
    '',
    `Accept invitation: ${invitationUrl}`,
    '',
    `This invitation expires on ${new Date(expiresAt).toUTCString()}.`,
  ].join('\n')
}

export async function sendUserInvitationEmail(input: SendUserInvitationEmailInput) {
  const resend = getResendClient()
  const { data, error } = await resend.emails.send(
    {
      from: process.env.RESEND_FROM_EMAIL ?? DEFAULT_FROM_ADDRESS,
      to: [input.invitedEmail],
      subject: `Join ${input.organizationName} on TaleLabs`,
      react: <UserInvitationEmail {...input} />,
      text: createInvitationText(input),
      tags: [
        { name: 'email_type', value: 'organization_invitation' },
        { name: 'invitation_id', value: input.invitationId },
      ],
    },
    {
      idempotencyKey: `organization-invitation/${input.invitationId}`,
    },
  )

  if (error)
    throw new EmailDeliveryError(error.message)

  return data
}
