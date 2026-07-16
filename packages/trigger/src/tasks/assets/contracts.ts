import { z } from 'zod'

export const assetTaskPayloadSchema = z.object({
  assetId: z.string(),
  organizationId: z.string(),
})

export type AssetTaskPayload = z.infer<typeof assetTaskPayloadSchema>
