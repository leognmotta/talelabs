import { z } from 'zod'

export const characterFormSchema = z.object({
  name: z.string().min(1).max(160),
  role: z.string().max(160),
  description: z.string().max(4000),
  personality: z.string().max(4000),
  visualNotes: z.string().max(4000),
  brandIds: z.array(z.string()),
})

export type CharacterFormValues = z.infer<typeof characterFormSchema>
