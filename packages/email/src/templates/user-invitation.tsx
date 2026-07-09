import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  pixelBasedPreset,
  Preview,
  Section,
  Tailwind,
  Text,
} from 'react-email'

export interface UserInvitationEmailProps {
  expiresAt: Date | string
  invitationUrl: string
  invitedEmail: string
  inviterName: string
  organizationName: string
  productName?: string
  role: 'admin' | 'member'
}

const theme = {
  background: '#ffffff',
  card: '#ffffff',
  foreground: '#171717',
  muted: '#f5f5f5',
  mutedForeground: '#737373',
  border: '#e5e5e5',
  primary: '#0f766e',
  primaryForeground: '#ecfdf5',
}

function formatExpiration(value: Date | string) {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function UserInvitationEmail({
  expiresAt,
  invitationUrl,
  invitedEmail,
  inviterName,
  organizationName,
  productName = 'TaleLabs',
  role,
}: UserInvitationEmailProps) {
  const preview = `${inviterName} invited you to join ${organizationName} on ${productName}.`

  return (
    <Html lang="en">
      <Tailwind
        config={{
          presets: [pixelBasedPreset],
          theme: {
            extend: {
              colors: {
                'background': theme.background,
                'border': theme.border,
                'card': theme.card,
                'foreground': theme.foreground,
                'muted': theme.muted,
                'muted-foreground': theme.mutedForeground,
                'primary': theme.primary,
                'primary-foreground': theme.primaryForeground,
              },
              fontFamily: {
                sans: [
                  'Inter',
                  'Arial',
                  'sans-serif',
                ],
              },
            },
          },
        }}
      >
        <Head />
        <Body className="m-0 bg-muted px-4 py-10 font-sans text-foreground">
          <Preview>{preview}</Preview>
          <Container className="
            mx-auto max-w-[560px] rounded-[10px] border border-solid
            border-border bg-card p-8
          "
          >
            <Section>
              <Text className="m-0 text-sm font-semibold text-primary">
                {productName}
              </Text>
              <Heading className="
                mt-3 mb-4 text-[28px] leading-[34px] font-semibold
                text-foreground
              "
              >
                Join
                {' '}
                {organizationName}
              </Heading>
              <Text className="m-0 text-[16px] leading-[26px] text-foreground">
                {inviterName}
                {' '}
                invited
                {' '}
                {invitedEmail}
                {' '}
                to join
                {' '}
                {organizationName}
                {' '}
                as an organization
                {' '}
                {role}
                .
              </Text>
            </Section>

            <Section className="py-7">
              <Button
                href={invitationUrl}
                className="
                  box-border block rounded-[8px] bg-primary px-5 py-3
                  text-center text-[14px] font-semibold text-primary-foreground
                  no-underline
                "
              >
                Accept invitation
              </Button>
            </Section>

            <Section className="
              rounded-[8px] border border-solid border-border bg-muted p-4
            "
            >
              <Text className="
                m-0 text-[13px] leading-[21px] text-muted-foreground
              "
              >
                This invitation expires on
                {' '}
                {formatExpiration(expiresAt)}
                . If the button does not work, paste this URL into your browser:
              </Text>
              <Text className="
                mt-2 mb-0 break-all text-[13px] leading-[21px]
                text-muted-foreground
              "
              >
                {invitationUrl}
              </Text>
            </Section>

            <Hr className="my-7 border-solid border-border" />

            <Text className="m-0 text-[12px] leading-[20px] text-muted-foreground">
              You received this transactional email because someone invited this
              address to a
              {' '}
              {productName}
              {' '}
              organization.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}

UserInvitationEmail.PreviewProps = {
  expiresAt: new Date('2026-07-16T14:00:00.000Z'),
  invitationUrl: 'https://app.talelabs.ai/accept-invitation?token=invite_123',
  invitedEmail: 'new-user@example.com',
  inviterName: 'Leonardo Motta',
  organizationName: 'TaleLabs',
  role: 'member',
} satisfies UserInvitationEmailProps
