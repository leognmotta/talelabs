import { Button } from '@talelabs/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@talelabs/ui/components/card'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { authClient } from '../auth/auth-client'

export function AcceptInvitationScreen({
  isSignedIn,
  onAccepted,
}: {
  isSignedIn: boolean
  onAccepted: (organizationId: string) => Promise<void>
}) {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')
  const [status, setStatus] = useState<'idle' | 'accepting' | 'accepted' | 'error'>('idle')
  const [messageKey, setMessageKey] = useState('invitations.accepting')

  useEffect(() => {
    if (!isSignedIn || !token || status !== 'idle')
      return

    async function acceptInvitation() {
      setStatus('accepting')

      const result = await authClient.organization.acceptInvitation({
        invitationId: token!,
      })

      if (result.error) {
        setStatus('error')
        setMessageKey('invitations.couldNotAccept')
        return
      }

      const organizationId = result.data?.member.organizationId

      if (!organizationId) {
        setStatus('error')
        setMessageKey('invitations.organizationMissing')
        return
      }

      await onAccepted(organizationId)
      setStatus('accepted')
      setMessageKey('invitations.success')
    }

    void acceptInvitation()
  }, [isSignedIn, onAccepted, status, token])

  if (!isSignedIn)
    return <Navigate to="/sign-in" replace />

  return (
    <main className="
      flex min-h-screen items-center justify-center bg-background px-6 py-8
      text-foreground
    "
    >
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardDescription>TaleLabs</CardDescription>
          <CardTitle>{t('invitations.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {token ? t(messageKey as 'invitations.accepting') : t('invitations.invalid')}
          </p>
        </CardContent>
        <CardFooter>
          <Button
            type="button"
            disabled={status === 'accepting'}
            onClick={() => navigate('/')}
          >
            {status === 'accepted'
              ? t('invitations.continue')
              : t('invitations.goToDashboard')}
          </Button>
        </CardFooter>
      </Card>
    </main>
  )
}
