export const mockedCurrentPlan = 'Free'

export interface SubscriptionPlan {
  description: string
  features: string[]
  id: 'creator' | 'studio' | 'business'
  label: string
  price: string
  recommended?: boolean
}

export const subscriptionPlans: SubscriptionPlan[] = [
  {
    description: 'For individual creators starting with TaleLabs.',
    features: ['Higher monthly limits', 'Private projects', 'Standard support'],
    id: 'creator',
    label: 'Creator',
    price: '$19/mo',
  },
  {
    description: 'For teams producing across brands and campaigns.',
    features: ['Shared workspace', 'Team roles', 'Priority generations'],
    id: 'studio',
    label: 'Studio',
    price: '$49/mo',
    recommended: true,
  },
  {
    description: 'For organizations that need advanced controls.',
    features: ['Advanced permissions', 'Dedicated support', 'Custom limits'],
    id: 'business',
    label: 'Business',
    price: '$149/mo',
  },
]

export type SubscriptionPlanId = SubscriptionPlan['id']
