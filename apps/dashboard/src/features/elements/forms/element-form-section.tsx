import type { ReactNode } from 'react'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@talelabs/ui/components/card'

export function ElementFormSection({
  children,
  description,
  id,
  title,
}: {
  children: ReactNode
  description: string
  id: string
  title: string
}) {
  return (
    <Card id={id} className="scroll-mt-6">
      <CardHeader className="border-b">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
