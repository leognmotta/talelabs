import { z } from 'zod'

export const brandFormSchema = z.object({
  name: z.string().min(1, 'Enter a brand name.').max(160),
  description: z.string().max(4000),
  toneOfVoice: z.string().max(4000),
  visualStyle: z.string().max(4000),
  doRules: z.string().max(8000),
  dontRules: z.string().max(8000),
  colors: z.array(z.object({
    name: z.string().min(1),
    hex: z.string().regex(/^#[0-9A-F]{6}$/i),
  })).max(24),
})

export type BrandFormValues = z.infer<typeof brandFormSchema>
