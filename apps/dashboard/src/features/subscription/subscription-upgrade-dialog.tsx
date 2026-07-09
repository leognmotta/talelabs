import type { SubscriptionPlanId } from './subscription-data'

import {
  IconCheck,
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
import {
  mockedCurrentPlan,
  subscriptionPlans,
} from './subscription-data'

export function SubscriptionUpgradeDialog({
  onOpenChange,
  open,
}: {
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  const [selectedPlanId, setSelectedPlanId] = useState<SubscriptionPlanId>('studio')
  const selectedPlan = subscriptionPlans.find(
    subscriptionPlan => subscriptionPlan.id === selectedPlanId,
  ) ?? subscriptionPlans[0]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="
        flex! h-svh max-h-svh w-screen max-w-none! flex-col gap-0 rounded-none!
        p-0
        sm:max-w-none!
      "
      >
        <DialogHeader className="border-b border-border px-6 py-5 pr-16">
          <DialogTitle>Upgrade plan</DialogTitle>
          <DialogDescription>
            Subscriptions unlock workspace capabilities; credits still cover usage.
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
                <CardTitle>Current plan</CardTitle>
                <CardDescription>
                  Upgrade subscription features separately from credits.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <Badge variant="secondary">{mockedCurrentPlan}</Badge>
                  <span className="text-sm text-muted-foreground">
                    Credits remain pay-as-you-go.
                  </span>
                </div>
              </CardContent>
            </Card>

            <div className="
              grid gap-4
              md:grid-cols-3
            "
            >
              {subscriptionPlans.map((subscriptionPlan) => {
                const isSelected = selectedPlanId === subscriptionPlan.id

                return (
                  <Card
                    key={subscriptionPlan.id}
                    className="shadow-none"
                    data-selected={isSelected}
                  >
                    <CardHeader>
                      <div className="flex items-center justify-between gap-3">
                        <CardTitle>{subscriptionPlan.label}</CardTitle>
                        {subscriptionPlan.recommended && (
                          <Badge variant="secondary">Recommended</Badge>
                        )}
                      </div>
                      <CardDescription>
                        {subscriptionPlan.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                      <div className="flex items-end gap-2">
                        <span className="text-3xl font-semibold">
                          {subscriptionPlan.price}
                        </span>
                      </div>
                      <ul className="flex flex-col gap-2">
                        {subscriptionPlan.features.map(feature => (
                          <li
                            key={feature}
                            className="flex items-center gap-2 text-sm"
                          >
                            <IconCheck />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                    <CardFooter>
                      <Button
                        type="button"
                        variant={isSelected ? 'default' : 'outline'}
                        className="w-full"
                        onClick={() => setSelectedPlanId(subscriptionPlan.id)}
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
                  Subscription checkout will be connected here.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">Plan</span>
                  <span className="text-sm font-medium">{selectedPlan.label}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">Billing</span>
                  <span className="text-sm font-medium">Monthly</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">Total</span>
                  <span className="text-lg font-semibold">{selectedPlan.price}</span>
                </div>
              </CardContent>
              <CardFooter className="flex-col gap-3">
                <Button type="button" className="w-full">
                  <IconCreditCard data-icon="inline-start" />
                  Continue to checkout
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  This is a mocked subscription flow until checkout is connected.
                </p>
              </CardFooter>
            </Card>

            <Card className="shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconSparkles />
                  Credits plus subscription
                </CardTitle>
                <CardDescription>
                  Plan upgrades unlock product features. Credits cover generation usage.
                </CardDescription>
              </CardHeader>
            </Card>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  )
}
