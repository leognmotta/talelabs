import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@talelabs/ui/components/card'

export function WorkspaceScreen({
  activeOrganizationId,
}: {
  activeOrganizationId: string | null
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>Workspace route</CardDescription>
        <CardTitle>React Router is active</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Organization:
          {' '}
          {activeOrganizationId}
        </p>
      </CardContent>
    </Card>
  )
}
