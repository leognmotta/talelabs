export const mockedCreditsBalance = 500

export interface CreditPackage {
  credits: number
  description: string
  id: 'starter' | 'studio' | 'scale'
  label: string
  price: string
  recommended?: boolean
}

export const creditPackages: CreditPackage[] = [
  {
    credits: 1000,
    description: 'Good for a few focused creative sessions.',
    id: 'starter',
    label: 'Starter',
    price: '$10',
  },
  {
    credits: 5000,
    description: 'A practical balance for weekly production work.',
    id: 'studio',
    label: 'Studio',
    price: '$40',
    recommended: true,
  },
  {
    credits: 15000,
    description: 'For heavier teams and larger content batches.',
    id: 'scale',
    label: 'Scale',
    price: '$100',
  },
]

export type CreditPackageId = CreditPackage['id']
