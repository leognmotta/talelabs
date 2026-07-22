/** Runtime validation and legacy-string construction for structured prompts. */

import type { PromptTemplate } from './contracts.js'

import { z } from 'zod'

/** Maximum authored prompt characters retained from the former textarea contract. */
export const MAX_PROMPT_TEMPLATE_CHARACTERS = 16_000

/** Maximum structured parts accepted in one persisted prompt. */
export const MAX_PROMPT_TEMPLATE_PARTS = 1_024

const promptTemplatePartSchema = z.discriminatedUnion('type', [
  z.strictObject({
    text: z.string(),
    type: z.literal('text'),
  }),
  z.strictObject({
    index: z.number().int().nonnegative(),
    mediaType: z.enum(['image', 'video', 'audio']),
    slotId: z.string().min(1).max(128),
    type: z.literal('input'),
  }),
  z.strictObject({ type: z.literal('break') }),
])

/** Strict persisted schema for the TaleLabs prompt contract. */
export const PromptTemplateSchema: z.ZodType<PromptTemplate> = z.strictObject({
  parts: z.array(promptTemplatePartSchema).max(MAX_PROMPT_TEMPLATE_PARTS),
  version: z.literal(1),
}).superRefine((template, context) => {
  const characters = template.parts.reduce((count, part) => {
    if (part.type === 'text')
      return count + part.text.length
    return count + 1
  }, 0)
  if (characters > MAX_PROMPT_TEMPLATE_CHARACTERS) {
    context.addIssue({
      code: 'custom',
      message: 'prompt_too_long',
      path: ['parts'],
    })
  }
})

/** Converts a historical plain string into the current prompt contract. */
export function promptTemplateFromText(text: string): PromptTemplate {
  const parts: PromptTemplate['parts'] = []
  for (const [index, line] of text.replaceAll('\r\n', '\n').split('\n').entries()) {
    if (index > 0)
      parts.push({ type: 'break' })
    if (line.length > 0)
      parts.push({ text: line, type: 'text' })
  }
  return { parts, version: 1 }
}

/** Reads current prompt data while tolerating an unhydrated historical string. */
export function coercePromptTemplate(value: unknown): PromptTemplate {
  if (typeof value === 'string')
    return promptTemplateFromText(value)
  return PromptTemplateSchema.parse(value)
}
