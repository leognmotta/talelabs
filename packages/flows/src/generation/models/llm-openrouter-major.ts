import { createLlmModel } from './llm.js'

const STANDARD_REASONING = {
  default: 'medium',
  mandatory: false,
  options: ['off', 'auto', 'low', 'medium', 'high'],
} as const

const OPENAI_REASONING = {
  ...STANDARD_REASONING,
  default: 'off',
  options: [...STANDARD_REASONING.options, 'xhigh'],
} as const

const VISION_DESCRIPTION = 'flows.modelDescriptions.majorVisionLlm'
const TEXT_DESCRIPTION = 'flows.modelDescriptions.majorTextLlm'

export const OPENROUTER_MAJOR_LLM_MODELS = [
  createLlmModel({
    descriptionKey: VISION_DESCRIPTION,
    displayName: 'GPT-5.5',
    id: 'talelabs/gpt-5.5',
    labelKey: 'flows.models.gpt55',
    reasoning: OPENAI_REASONING,
    vision: true,
  }),
  createLlmModel({
    descriptionKey: VISION_DESCRIPTION,
    displayName: 'GPT-5.6 SOL',
    id: 'talelabs/gpt-5.6-sol',
    labelKey: 'flows.models.gpt56Sol',
    reasoning: OPENAI_REASONING,
    vision: true,
  }),
  createLlmModel({
    descriptionKey: VISION_DESCRIPTION,
    displayName: 'Claude Opus 4.8',
    id: 'talelabs/claude-opus-4.8',
    labelKey: 'flows.models.claudeOpus48',
    reasoning: STANDARD_REASONING,
    vision: true,
  }),
  createLlmModel({
    descriptionKey: VISION_DESCRIPTION,
    displayName: 'Claude Sonnet 5',
    id: 'talelabs/claude-sonnet-5',
    labelKey: 'flows.models.claudeSonnet5',
    reasoning: STANDARD_REASONING,
    vision: true,
  }),
  createLlmModel({
    descriptionKey: VISION_DESCRIPTION,
    displayName: 'Gemini 3.5 Flash',
    id: 'talelabs/gemini-3.5-flash',
    labelKey: 'flows.models.gemini35Flash',
    reasoning: STANDARD_REASONING,
    vision: true,
  }),
  createLlmModel({
    descriptionKey: VISION_DESCRIPTION,
    displayName: 'Grok 4.5',
    id: 'talelabs/grok-4.5',
    labelKey: 'flows.models.grok45',
    reasoning: STANDARD_REASONING,
    vision: true,
  }),
  createLlmModel({
    descriptionKey: TEXT_DESCRIPTION,
    displayName: 'DeepSeek V4 Pro',
    id: 'talelabs/deepseek-v4-pro',
    labelKey: 'flows.models.deepseekV4Pro',
    reasoning: STANDARD_REASONING,
    vision: false,
  }),
  createLlmModel({
    descriptionKey: TEXT_DESCRIPTION,
    displayName: 'GLM-5.2',
    id: 'talelabs/glm-5.2',
    labelKey: 'flows.models.glm52',
    reasoning: STANDARD_REASONING,
    vision: false,
  }),
  createLlmModel({
    descriptionKey: VISION_DESCRIPTION,
    displayName: 'Qwen3.7 Plus',
    id: 'talelabs/qwen3.7-plus',
    labelKey: 'flows.models.qwen37Plus',
    reasoning: STANDARD_REASONING,
    vision: true,
  }),
  createLlmModel({
    descriptionKey: VISION_DESCRIPTION,
    displayName: 'Kimi K2.5',
    id: 'talelabs/kimi-k2.5',
    labelKey: 'flows.models.kimiK25',
    reasoning: STANDARD_REASONING,
    vision: true,
  }),
] as const
