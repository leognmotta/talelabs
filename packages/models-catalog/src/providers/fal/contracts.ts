/** fal.ai queue binding contracts shared by catalog, browser, and providers. */

import type { CatalogProviderBindingCommon } from '../contracts.js'

/** Base URL every fal queue submission, status poll, and result read shares. */
export const FAL_QUEUE_BASE = 'https://queue.fal.run'

/** Single wire protocol implemented by the fal provider boundary. */
export type CatalogFalProtocol = 'queue'

/** Adapter version pinned by every reviewed fal queue binding. */
export const FAL_QUEUE_ADAPTER_VERSION = 'fal-queue-v1'

/** Values a fal request field may be set to from settings or constants. */
export type CatalogFalParamValue = boolean | number | string

/** Explicit pixel dimensions accepted by fal's shared `image_size` field. */
export interface CatalogFalImageDimensions {
  /** Requested output height in pixels. */
  height: number
  /** Requested output width in pixels. */
  width: number
}

/** Values produced by a reviewed declarative fal setting map. */
export type CatalogFalMappedParamValue
  = | CatalogFalImageDimensions
    | CatalogFalParamValue

/** Maps one normalized media slot onto one exact fal request field. */
export interface CatalogFalInputMapping {
  /** Optional media-specific fields used when one TaleLabs slot accepts a union. */
  alternativeFields?: readonly CatalogFalAlternativeInputField[]
  /** Whether the fal field receives one URL or an ordered URL array. */
  cardinality: 'many' | 'single'
  /** Exact fal request field receiving the resolved provider URL value. */
  field: string
  /** Maximum media items this specific fal field accepts. */
  maxItems: number
  /** Media family required for every Asset routed through this mapping. */
  mediaType: 'audio' | 'image' | 'video'
  /** Minimum media items required for this specific fal field. */
  minItems: number
  /** TaleLabs semantic input slot consumed by this fal field. */
  targetSlotId: string
}

/** One alternative fal field selected by the runtime Asset media family. */
export interface CatalogFalAlternativeInputField {
  /** Exact fal request field receiving the resolved provider URL value. */
  field: string
  /** Media family that selects this field instead of the mapping's primary field. */
  mediaType: 'audio' | 'image' | 'video'
}

/** Maps one TaleLabs setting onto a fal request field with optional remap. */
export interface CatalogFalSettingParam {
  /** fal request field name receiving the setting value. */
  field: string
  /** Optional positive multiplier applied to numeric settings before submission. */
  numberMultiplier?: number
  /** Optional condition that omits the field unless another setting matches. */
  sendWhen?: CatalogFalSettingCondition
  /** TaleLabs setting id supplying the value. */
  settingId: string
  /** Optional TaleLabs → fal value remap for enum-shaped settings. */
  valueMap?: Readonly<Record<string, CatalogFalParamValue>>
}

/** One exact setting equality condition controlling a fal request field. */
export interface CatalogFalSettingCondition {
  /** Required value of the controlling setting. */
  equals: CatalogFalParamValue
  /** TaleLabs setting id evaluated before the request field is emitted. */
  settingId: string
}

/** Maps two normalized enum settings onto one exact fal request field. */
export interface CatalogFalCombinedSettingParam {
  /** fal request field receiving the mapped composite value. */
  field: string
  /** Ordered TaleLabs setting IDs used as the two lookup dimensions. */
  settingIds: readonly [string, string]
  /** Complete first-setting → second-setting → fal-value lookup table. */
  valueMap: Readonly<
    Record<string, Readonly<Record<string, CatalogFalMappedParamValue>>>
  >
}

/** Request-shaping policy for fal image models. */
export interface CatalogFalImageRequestProfile {
  /** Declarative two-setting → one-field mappings applied to the request. */
  combinedParams: readonly CatalogFalCombinedSettingParam[]
  /** Protocol discriminator. */
  kind: 'image'
  /** Exact normalized media-slot mappings consumed by this endpoint. */
  inputMappings: readonly CatalogFalInputMapping[]
  /** Combined media-item limit enforced before any provider submission. */
  maxInputItems: number
  /** Declarative setting → fal field mapping applied to the request. */
  params: readonly CatalogFalSettingParam[]
  /** fal field receiving the prompt text, usually `prompt`. */
  promptField: string | null
  /** fal field receiving the requested output count, or `null` for fixed one. */
  requestedCountField: string | null
  /** Constant fal fields always sent with the request. */
  staticParams: Readonly<Record<string, CatalogFalParamValue>>
  /** Ordered TaleLabs setting IDs mapped into the request. */
  settingIds: readonly string[]
}

/** Request-shaping policy for fal video models. */
export interface CatalogFalVideoRequestProfile {
  /** Declarative two-setting → one-field mappings applied to the request. */
  combinedParams: readonly CatalogFalCombinedSettingParam[]
  /** Exact normalized media-slot mappings consumed by this endpoint. */
  inputMappings: readonly CatalogFalInputMapping[]
  /** Protocol discriminator. */
  kind: 'video'
  /** Combined media-item limit enforced before any provider submission. */
  maxInputItems: number
  /** Declarative setting → fal field mapping applied to the request. */
  params: readonly CatalogFalSettingParam[]
  /** fal field receiving the prompt text, usually `prompt`. */
  promptField: string | null
  /** Constant fal fields always sent with the request. */
  staticParams: Readonly<Record<string, CatalogFalParamValue>>
  /** Ordered TaleLabs setting IDs mapped into the request. */
  settingIds: readonly string[]
}

/** Request-shaping policy for fal speech and audio models. */
export interface CatalogFalSpeechRequestProfile {
  /** Declarative two-setting → one-field mappings applied to the request. */
  combinedParams: readonly CatalogFalCombinedSettingParam[]
  /** Exact normalized media-slot mappings consumed by this endpoint. */
  inputMappings: readonly CatalogFalInputMapping[]
  /** Protocol discriminator. */
  kind: 'speech'
  /** Combined media-item limit enforced before any provider submission. */
  maxInputItems: number
  /** Declarative setting → fal field mapping applied to the request. */
  params: readonly CatalogFalSettingParam[]
  /** fal field receiving the input text, usually `text`. */
  promptField: string | null
  /** Constant fal fields always sent with the request. */
  staticParams: Readonly<Record<string, CatalogFalParamValue>>
  /** Ordered TaleLabs setting IDs mapped into the request. */
  settingIds: readonly string[]
}

/** Every fal request profile variant, discriminated by media kind. */
export type CatalogFalRequestProfile
  = | CatalogFalImageRequestProfile
    | CatalogFalSpeechRequestProfile
    | CatalogFalVideoRequestProfile

/** Immutable fal queue binding captured at run admission. */
export interface CatalogFalProviderBinding extends CatalogProviderBindingCommon {
  /** Pinned fal queue base URL for submission and polling. */
  endpoint: typeof FAL_QUEUE_BASE
  /** fal provider discriminator. */
  provider: 'fal'
  /** Stable transport tag captured in the immutable snapshot. */
  providerTag: 'fal-queue'
  /** Single fal wire protocol discriminator. */
  protocol: 'queue'
  /** Media-specific request shaping policy. */
  requestProfile: CatalogFalRequestProfile
}
