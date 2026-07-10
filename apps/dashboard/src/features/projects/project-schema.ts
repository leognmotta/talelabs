import { z } from 'zod'

export const projectFormSchema = z.object({
  name: z.string().min(1, 'Enter a project name.').max(160),
  description: z.string().max(4000),
})

export type ProjectFormValues = z.infer<typeof projectFormSchema>
