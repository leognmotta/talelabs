import type { ElementType } from '@talelabs/elements'
import type { ComponentType, ReactNode } from 'react'

export interface ElementFormSubmission {
  data: Record<string, unknown>
  instructions?: string
  name: string
}

export interface ElementFormProps {
  assetsSection?: ReactNode
  initialValue?: Partial<ElementFormSubmission>
  onSubmit: (value: ElementFormSubmission) => Promise<void>
  pending: boolean
  submitLabel: string
}

export type ElementFormComponent = ComponentType<ElementFormProps>

export interface ElementFormRegistryEntry {
  Form: ElementFormComponent
  type: ElementType
}
