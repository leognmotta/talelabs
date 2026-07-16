/** Deterministic model-adaptive resolver scenarios for current catalog records. */

import type { GenerationModelDefinition } from '../registry/types.js'

import { GENERATION_MODEL_REGISTRY } from '../registry/index.js'
import { resolveImageGenerationState } from '../resolution/image.js'
import { resolveLlmState } from '../resolution/llm.js'
import { resolveVideoGenerationState } from '../resolution/video.js'

function defaultSettings(model: GenerationModelDefinition) {
  return Object.fromEntries(
    model.settings.map(setting => [setting.id, setting.default]),
  )
}

const veo31 = GENERATION_MODEL_REGISTRY['google/veo-3.1']
const seedance20 = GENERATION_MODEL_REGISTRY['bytedance/seedance-2.0']
const nanoBanana2 = GENERATION_MODEL_REGISTRY['google/gemini-3.1-flash-image']
const recraft41 = GENERATION_MODEL_REGISTRY['recraft/recraft-v4.1']
const gemini31FlashLite
  = GENERATION_MODEL_REGISTRY['google/gemini-3.1-flash-lite']
const gemini31Pro = GENERATION_MODEL_REGISTRY['google/gemini-3.1-pro-preview']
const deepseekV32 = GENERATION_MODEL_REGISTRY['deepseek/deepseek-v3.2']
const mistralLarge3 = GENERATION_MODEL_REGISTRY['mistralai/mistral-large-2512']

/** Verifies operation and readiness resolution for representative model inputs. */
export function validateGenerationResolverCapabilityScenarios() {
  const errors: string[] = []
  const resolverScenarios = [
    {
      actual: resolveVideoGenerationState({
        inlinePrompt: 'A calm establishing shot',
        model: veo31,
        settings: defaultSettings(veo31),
      }),
      expectedOperationId: 'textToVideo',
      expectedReadiness: 'ready',
      name: 'inline prompt resolves the default text operation',
    },
    {
      actual: resolveVideoGenerationState({
        connectionCounts: { lastFrame: 1 },
        inlinePrompt: 'Move toward the final composition',
        model: veo31,
        settings: defaultSettings(veo31),
      }),
      expectedOperationId: 'firstLastFrameToVideo',
      expectedReadiness: 'incomplete',
      name: 'last frame establishes frame intent while first frame remains required',
    },
    {
      actual: resolveVideoGenerationState({
        connectionCounts: { audioReferences: 1, imageReferences: 1 },
        inlinePrompt: 'Follow the reference timing',
        model: seedance20,
        settings: defaultSettings(seedance20),
      }),
      expectedOperationId: 'referencesToVideo',
      expectedReadiness: 'ready',
      name: 'multimodal references resolve one shared reference operation',
    },
    {
      actual: resolveVideoGenerationState({
        connectionCounts: { audioReferences: 1 },
        inlinePrompt: 'Follow the reference timing',
        model: seedance20,
        settings: defaultSettings(seedance20),
      }),
      expectedOperationId: 'referencesToVideo',
      expectedReadiness: 'incomplete',
      name: 'Seedance audio-only intent remains incomplete until visual guidance is connected',
    },
    {
      actual: resolveVideoGenerationState({
        connectionCounts: { firstFrame: 1, imageReferences: 1 },
        inlinePrompt: 'Conflicting intent',
        model: seedance20,
        settings: defaultSettings(seedance20),
      }),
      expectedOperationId: null,
      expectedReadiness: 'invalid',
      name: 'frame and reference families cannot coexist',
    },
  ] as const
  for (const scenario of resolverScenarios) {
    if (
      scenario.actual.resolvedOperationId !== scenario.expectedOperationId
      || scenario.actual.readiness !== scenario.expectedReadiness
    ) {
      errors.push(
        `${scenario.name}: expected ${scenario.expectedOperationId}/${scenario.expectedReadiness}, received ${scenario.actual.resolvedOperationId}/${scenario.actual.readiness}`,
      )
    }
  }

  const imageResolverScenarios = [
    {
      actual: resolveImageGenerationState({
        inlinePrompt: 'A studio portrait',
        model: nanoBanana2,
        settings: defaultSettings(nanoBanana2),
      }),
      expectedAvailability: 'available',
      expectedOperationId: 'textToImage',
      expectedReadiness: 'ready',
      name: 'image inline prompt resolves text to image',
    },
    {
      actual: resolveImageGenerationState({
        connectionCounts: { imageReferences: 1 },
        inlinePrompt: 'Keep the subject identity',
        itemCounts: { imageReferences: 4 },
        model: nanoBanana2,
        settings: defaultSettings(nanoBanana2),
      }),
      expectedAvailability: 'connected',
      expectedOperationId: 'imageToImage',
      expectedReadiness: 'ready',
      name: 'selected image items resolve image to image',
    },
    {
      actual: resolveImageGenerationState({
        connectionCounts: { imageReferences: 1 },
        itemCounts: { imageReferences: 14 },
        model: nanoBanana2,
        settings: defaultSettings(nanoBanana2),
      }),
      expectedAvailability: 'full',
      expectedOperationId: 'imageToImage',
      expectedReadiness: 'incomplete',
      name: 'image reference runtime item limit is full',
    },
    {
      actual: resolveImageGenerationState({
        connectionCounts: { imageReferences: 1 },
        inlinePrompt: 'Use this reference image',
        itemCounts: { imageReferences: 1 },
        model: recraft41,
        settings: defaultSettings(recraft41),
      }),
      expectedAvailability: 'full',
      expectedOperationId: 'imageToImage',
      expectedReadiness: 'ready',
      name: 'Recraft accepts its reviewed single image reference',
    },
  ] as const
  for (const scenario of imageResolverScenarios) {
    const availability
      = scenario.actual.inputAvailability.imageReferences?.state
    if (
      scenario.actual.resolvedOperationId !== scenario.expectedOperationId
      || scenario.actual.readiness !== scenario.expectedReadiness
      || availability !== scenario.expectedAvailability
    ) {
      errors.push(
        `${scenario.name}: expected ${scenario.expectedOperationId}/${scenario.expectedReadiness}/${scenario.expectedAvailability}, received ${scenario.actual.resolvedOperationId}/${scenario.actual.readiness}/${availability}`,
      )
    }
  }

  const llmResolverScenarios = [
    {
      actual: resolveLlmState({
        inlinePrompt: 'Rewrite this creative brief',
        model: gemini31FlashLite,
        settings: defaultSettings(gemini31FlashLite),
      }),
      expectedAvailability: 'available',
      expectedOperationId: 'textToText',
      expectedReadiness: 'ready',
      name: 'LLM inline prompt resolves text to text',
    },
    {
      actual: resolveLlmState({
        connectionCounts: { imageReferences: 1, prompt: 1 },
        itemCounts: { imageReferences: 8, prompt: 1 },
        model: gemini31FlashLite,
        settings: defaultSettings(gemini31FlashLite),
      }),
      expectedAvailability: 'full',
      expectedOperationId: 'visionToText',
      expectedReadiness: 'ready',
      name: 'LLM vision operation accepts exactly eight images',
    },
    {
      actual: resolveLlmState({
        connectionCounts: { imageReferences: 1, prompt: 1 },
        itemCounts: { imageReferences: 9, prompt: 1 },
        model: gemini31FlashLite,
        settings: defaultSettings(gemini31FlashLite),
      }),
      expectedAvailability: 'full',
      expectedOperationId: 'visionToText',
      expectedReadiness: 'invalid',
      name: 'LLM vision operation rejects a ninth image',
    },
    {
      actual: resolveLlmState({
        connectionCounts: { imageReferences: 1, prompt: 1 },
        itemCounts: { imageReferences: 1, prompt: 1 },
        model: deepseekV32,
        settings: defaultSettings(deepseekV32),
      }),
      expectedAvailability: 'unsupported',
      expectedOperationId: null,
      expectedReadiness: 'invalid',
      name: 'text-only LLM rejects image references',
    },
    {
      actual: resolveLlmState({
        inlinePrompt: 'Analyze the composition',
        model: gemini31Pro,
        settings: { ...defaultSettings(gemini31Pro), reasoningMode: 'off' },
      }),
      expectedAvailability: 'available',
      expectedOperationId: 'textToText',
      expectedReadiness: 'invalid',
      expectedReasoning: 'medium',
      name: 'mandatory reasoning normalizes unsupported Off',
    },
    {
      actual: resolveLlmState({
        inlineInstructions: 'Answer as a creative director',
        inlinePrompt: 'Create three scene ideas',
        model: mistralLarge3,
        settings: defaultSettings(mistralLarge3),
      }),
      expectedAvailability: 'available',
      expectedOperationId: 'textToText',
      expectedReadiness: 'ready',
      expectedReasoning: undefined,
      name: 'non-reasoning LLM has no reasoning setting',
    },
  ] as const
  for (const scenario of llmResolverScenarios) {
    const availability
      = scenario.actual.inputAvailability.imageReferences?.state
    const reasoning = scenario.actual.normalizedSettings.reasoningMode
    if (
      scenario.actual.resolvedOperationId !== scenario.expectedOperationId
      || scenario.actual.readiness !== scenario.expectedReadiness
      || availability !== scenario.expectedAvailability
      || ('expectedReasoning' in scenario
        && reasoning !== scenario.expectedReasoning)
    ) {
      errors.push(
        `${scenario.name}: expected ${scenario.expectedOperationId}/${scenario.expectedReadiness}/${scenario.expectedAvailability}/${'expectedReasoning' in scenario ? scenario.expectedReasoning : '-'}, received ${scenario.actual.resolvedOperationId}/${scenario.actual.readiness}/${availability}/${String(reasoning)}`,
      )
    }
  }
  return errors
}
