import type { ZodType } from 'zod'

import { z } from 'zod'

export const ElementNameInputSchema = z.string()
  .trim()
  .min(1, 'validation.required')
  .max(255, 'validation.maxLength')

export const ElementInstructionsInputSchema = z.string()
  .trim()
  .max(10_000, 'validation.maxLength')

export function createElementFormSchema<DataSchema extends ZodType>(data: DataSchema) {
  return z.object({
    name: ElementNameInputSchema,
    data,
  })
}

export function createElementFormSchemaWithInstructions<
  DataSchema extends ZodType,
>(data: DataSchema) {
  return z.object({
    name: ElementNameInputSchema,
    instructions: ElementInstructionsInputSchema,
    data,
  })
}
