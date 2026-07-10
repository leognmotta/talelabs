import { z } from 'zod'

const listItemSchema = z.object({
  value: z.string().min(1).max(500),
})

export const productFormSchema = z.object({
  name: z.string().min(1).max(160),
  brandId: z.string(),
  description: z.string().max(4000),
  features: z.array(listItemSchema),
  benefits: z.array(listItemSchema),
})

export type ProductFormValues = z.infer<typeof productFormSchema>
