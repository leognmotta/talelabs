import type { CreditPackageId } from './credits-data'

import {
  IconCoins,
  IconCreditCard,
  IconSparkles,
} from '@tabler/icons-react'
import { Badge } from '@talelabs/ui/components/badge'
import { Button } from '@talelabs/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@talelabs/ui/components/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@talelabs/ui/components/dialog'
import { Separator } from '@talelabs/ui/components/separator'
import { useState } from 'react'
import { creditPackages } from './credits-data'

export function CreditsPurchaseDialog({
  creditsBalance,
  onOpenChange,
  open,
}: {
  creditsBalance: number
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  const [selectedPackageId, setSelectedPackageId] = useState<CreditPackageId>('studio')
  const selectedPackage = creditPackages.find(
    creditPackage => creditPackage.id === selectedPackageId,
  ) ?? creditPackages[0]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="
        flex! h-svh max-h-svh w-screen max-w-none! flex-col gap-0 rounded-none!
        p-0
        sm:max-w-none!
      "
      >
        <DialogHeader className="border-b border-border px-6 py-5 pr-16">
          <DialogTitle>Buy credits</DialogTitle>
          <DialogDescription>
            Credits are used for generations across Create and asset workflows.
          </DialogDescription>
        </DialogHeader>

        <div className="
          flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto p-6
          lg:grid lg:grid-cols-[minmax(0,1fr)_22rem]
        "
        >
          <section className="flex min-w-0 flex-col gap-6">
            <Card className="shadow-none">
              <CardHeader>
                <CardTitle>Credits balance</CardTitle>
                <CardDescription>
                  Current mocked balance for this workspace.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-2">
                  <span className="text-5xl font-semibold tracking-normal">
                    {creditsBalance.toLocaleString()}
                  </span>
                  <span className="pb-1 text-sm text-muted-foreground">
                    credits
                  </span>
                </div>
              </CardContent>
            </Card>

            <div className="
              grid gap-4
              md:grid-cols-3
            "
            >
              {creditPackages.map((creditPackage) => {
                const isSelected = selectedPackageId === creditPackage.id

                return (
                  <Card
                    key={creditPackage.id}
                    className="shadow-none"
                    data-selected={isSelected}
                  >
                    <CardHeader>
                      <div className="flex items-center justify-between gap-3">
                        <CardTitle>{creditPackage.label}</CardTitle>
                        {creditPackage.recommended && (
                          <Badge variant="secondary">Recommended</Badge>
                        )}
                      </div>
                      <CardDescription>
                        {creditPackage.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2">
                      <div className="flex items-end gap-2">
                        <span className="text-3xl font-semibold">
                          {creditPackage.price}
                        </span>
                        <span className="pb-1 text-sm text-muted-foreground">
                          one-time
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <IconCoins />
                        <span>
                          {creditPackage.credits.toLocaleString()}
                          {' '}
                          credits
                        </span>
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button
                        type="button"
                        variant={isSelected ? 'default' : 'outline'}
                        className="w-full"
                        onClick={() => setSelectedPackageId(creditPackage.id)}
                      >
                        {isSelected ? 'Selected' : 'Select'}
                      </Button>
                    </CardFooter>
                  </Card>
                )
              })}
            </div>
          </section>

          <aside className="flex min-w-0 flex-col gap-4">
            <Card className="shadow-none">
              <CardHeader>
                <CardTitle>Checkout summary</CardTitle>
                <CardDescription>
                  Payment checkout will be connected here.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">Package</span>
                  <span className="text-sm font-medium">{selectedPackage.label}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">Credits</span>
                  <span className="text-sm font-medium">
                    {selectedPackage.credits.toLocaleString()}
                  </span>
                </div>
                <Separator />
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">Total</span>
                  <span className="text-lg font-semibold">{selectedPackage.price}</span>
                </div>
              </CardContent>
              <CardFooter className="flex-col gap-3">
                <Button type="button" className="w-full">
                  <IconCreditCard data-icon="inline-start" />
                  Continue to checkout
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  This is a mocked purchase flow until checkout is connected.
                </p>
              </CardFooter>
            </Card>

            <Card className="shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconSparkles />
                  Usage
                </CardTitle>
                <CardDescription>
                  Credits will apply to image, video, audio, and workflow runs.
                </CardDescription>
              </CardHeader>
            </Card>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  )
}
