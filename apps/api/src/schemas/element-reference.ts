import { z } from '@hono/zod-openapi'
import {
  ELEMENT_REFERENCE_BACKGROUNDS,
  ELEMENT_REFERENCE_FRAMINGS,
  ELEMENT_REFERENCE_KINDS,
  ELEMENT_REFERENCE_VARIANT_MAX_LENGTH,
  ELEMENT_REFERENCE_VIEWS,
} from '@talelabs/elements'

export const ElementReferenceKindSchema = z.enum(ELEMENT_REFERENCE_KINDS)
  .openapi('ElementReferenceKind')

export const ElementReferenceMetadataSchema = z.object({
  view: z.enum(ELEMENT_REFERENCE_VIEWS).optional(),
  framing: z.enum(ELEMENT_REFERENCE_FRAMINGS).optional(),
  background: z.enum(ELEMENT_REFERENCE_BACKGROUNDS).optional(),
  variant: z.string().trim().min(1).max(ELEMENT_REFERENCE_VARIANT_MAX_LENGTH).optional(),
}).strict().openapi('ElementReferenceMetadata')
