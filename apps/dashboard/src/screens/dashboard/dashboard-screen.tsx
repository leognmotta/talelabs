import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@connecto/ui/components/card'

export function DashboardScreen({
  meQueryStatus,
  organizationMessage,
}: {
  meQueryStatus: string
  organizationMessage: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>Organization access</CardDescription>
        <CardTitle>{organizationMessage}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          SDK /me status:
          {' '}
          {meQueryStatus}
        </p>
      </CardContent>
    </Card>
  )
}
