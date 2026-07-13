import { z } from 'zod'

import { focusedText } from './schema-utils.js'

export const ELEMENT_REFERENCE_KINDS = Object.freeze([
  'source',
  'master',
] as const)

export type ElementReferenceKind = typeof ELEMENT_REFERENCE_KINDS[number]

/**
 * Element-wide abuse-protection limit for raw source evidence.
 *
 * Approved master references use the per-role limits in the Element registry.
 * This value is internal product policy and is not user-facing vocabulary.
 */
export const ELEMENT_SOURCE_CAPACITY = 50

export const ELEMENT_IDENTITY_SUMMARY_MAX_LENGTH = 2_000
export const ELEMENT_IDENTITY_RULE_MAX_ITEMS = 20
export const ELEMENT_IDENTITY_RULE_MAX_LENGTH = 240

const ElementIdentityRuleSchema = focusedText(ELEMENT_IDENTITY_RULE_MAX_LENGTH)
  .min(1, 'validation.required')

/** Shared identity guidance added to every current Element data contract. */
export const ElementIdentitySchema = z.object({
  summary: focusedText(ELEMENT_IDENTITY_SUMMARY_MAX_LENGTH).default(''),
  mustKeep: z.array(ElementIdentityRuleSchema)
    .max(ELEMENT_IDENTITY_RULE_MAX_ITEMS, 'validation.maxItems')
    .default([]),
  mayVary: z.array(ElementIdentityRuleSchema)
    .max(ELEMENT_IDENTITY_RULE_MAX_ITEMS, 'validation.maxItems')
    .default([]),
  avoid: z.array(ElementIdentityRuleSchema)
    .max(ELEMENT_IDENTITY_RULE_MAX_ITEMS, 'validation.maxItems')
    .default([]),
}).strict()

export type ElementIdentity = z.infer<typeof ElementIdentitySchema>

export function createEmptyElementIdentity(): ElementIdentity {
  return {
    summary: '',
    mustKeep: [],
    mayVary: [],
    avoid: [],
  }
}

export const ELEMENT_REFERENCE_VIEWS = Object.freeze([
  'front',
  'threeQuarter',
  'profile',
  'rear',
] as const)

export const ELEMENT_REFERENCE_FRAMINGS = Object.freeze([
  'portrait',
  'halfBody',
  'fullBody',
  'detail',
] as const)

export const ELEMENT_REFERENCE_BACKGROUNDS = Object.freeze([
  'clean',
  'environment',
] as const)
export const ELEMENT_REFERENCE_VARIANT_MAX_LENGTH = 120

export type ElementReferenceView = typeof ELEMENT_REFERENCE_VIEWS[number]
export type ElementReferenceFraming = typeof ELEMENT_REFERENCE_FRAMINGS[number]
export type ElementReferenceBackground = typeof ELEMENT_REFERENCE_BACKGROUNDS[number]

/**
 * Relationship-specific interpretation of an Element reference.
 *
 * The intersection keeps the parsed value assignable to JSON-object columns
 * while the strict schema below guarantees that only these stable keys exist.
 */
export type ElementReferenceMetadata = {
  background?: ElementReferenceBackground
  framing?: ElementReferenceFraming
  variant?: string
  view?: ElementReferenceView
} & Record<string, string | undefined>

export const ElementReferenceMetadataSchema: z.ZodType<ElementReferenceMetadata>
  = z.object({
    view: z.enum(ELEMENT_REFERENCE_VIEWS).optional(),
    framing: z.enum(ELEMENT_REFERENCE_FRAMINGS).optional(),
    background: z.enum(ELEMENT_REFERENCE_BACKGROUNDS).optional(),
    variant: focusedText(ELEMENT_REFERENCE_VARIANT_MAX_LENGTH)
      .min(1, 'validation.required')
      .optional(),
  }).strict()

export function parseElementReferenceMetadata(
  input: unknown = {},
): ElementReferenceMetadata {
  return ElementReferenceMetadataSchema.parse(input ?? {})
}

export const ElementReadinessSchema = z.object({
  state: z.enum(['empty', 'usable', 'strong']),
  missing: z.array(z.string().min(1).max(160)).max(20),
  recommendations: z.array(z.string().min(1).max(160)).max(20),
}).strict()

export type ElementReadiness = z.infer<typeof ElementReadinessSchema>

export interface ElementReadinessReference {
  /** Fail-closed usability computed from the canonical Asset state. */
  isUsable: boolean

  /** Only approved masters can contribute to readiness. */
  referenceKind: ElementReferenceKind

  /** Registry-validated interpretation of this particular relationship. */
  referenceMetadata: unknown

  /** Stable Element Asset role ID. */
  role: string
}

export interface ElementReadinessMetadataCriteria {
  background?: readonly ElementReferenceBackground[]
  framing?: readonly ElementReferenceFraming[]
  view?: readonly ElementReferenceView[]
}

export interface ElementReadinessEvidenceRequirement {
  /** Stable translation key/diagnostic ID returned when evidence is missing. */
  id: string

  /** Optional metadata evidence that a matching reference must carry. */
  referenceMetadata?: ElementReadinessMetadataCriteria

  /** Stable translation key/diagnostic ID describing the improvement. */
  recommendation: string

  /** One matching usable master in any of these roles satisfies the rule. */
  roles: readonly string[]
}

export interface ElementReadinessDefinition {
  /**
   * Evidence needed before an Element is immediately usable. `null` means any
   * valid role, including a user-defined role on the Other Element type.
   */
  usableRoles: null | readonly string[]

  /** Every rule must be evidenced before the evaluator may claim `strong`. */
  strongEvidence: readonly ElementReadinessEvidenceRequirement[]
}

export const DEFAULT_ELEMENT_READINESS_DEFINITION = Object.freeze({
  usableRoles: null,
  strongEvidence: [],
} as const satisfies ElementReadinessDefinition)

export const CHARACTER_ELEMENT_READINESS_DEFINITION = Object.freeze({
  usableRoles: ['appearance'],
  strongEvidence: [
    {
      id: 'elements.readiness.missing.cleanPortrait',
      recommendation: 'elements.readiness.recommendations.addCleanPortrait',
      roles: ['appearance'],
      referenceMetadata: {
        background: ['clean'],
        framing: ['portrait'],
      },
    },
    {
      id: 'elements.readiness.missing.secondaryView',
      recommendation: 'elements.readiness.recommendations.addSecondaryView',
      roles: ['appearance'],
      referenceMetadata: {
        view: ['threeQuarter', 'profile'],
      },
    },
    {
      id: 'elements.readiness.missing.fullBody',
      recommendation: 'elements.readiness.recommendations.addFullBody',
      roles: ['appearance'],
      referenceMetadata: {
        framing: ['fullBody'],
      },
    },
  ],
} as const satisfies ElementReadinessDefinition)

export const ELEMENT_READINESS_MISSING_REFERENCE_ID
  = 'elements.readiness.missing.reference'
export const ELEMENT_READINESS_ADD_REFERENCE_RECOMMENDATION_ID
  = 'elements.readiness.recommendations.addReference'
