import type { GenerationModelDefinition } from '../src/index.js'
import { createHash } from 'node:crypto'
import {
  areGenerationModelContractsEquivalent,
  GENERATION_MODEL_CONTRACT_VERSION,
  GENERATION_MODEL_CONTRACTS,
  GENERATION_MODEL_REGISTRY,
  validateFlowNodeRegistry,
  validateGenerationCapabilityScenarios,
  validateGenerationRegistry,
  validateHardenedGenerationRegistry,
} from '../src/index.js'

const RELEASED_CONTRACT_HASHES = {
  '2026-07-12.2':
    '62888b1d6d30f2e1fcc298a07017c6fda944e226e453c62f01ae69f03486bddc',
  '2026-07-12.3':
    '7211760d189428d67ca81fd78fb8e0d07352baf19d743f6f16f9c36ef47adcef',
  '2026-07-12.4':
    'a7863954ecaaf00ead74bc8beb6cd687169775155d00e4f6c280f97d4d6ff708',
  '2026-07-12.5':
    '66470a36f0f82e3e0186090136b9d5fe0a11f04f42f06aa830fee2c5896a00e6',
  '2026-07-13.1':
    'f4f9967a908d5c5f98f86b02e25ed10ac0dde356ba8504b97d7ea7875e1a0a78',
  '2026-07-13.2':
    '0447280d96336a54d925a45145f6a8260b36e1b1d9c34b03ed2a19401c58f245',
  '2026-07-13.3':
    '52a3f4e9f3c064cb86ded24df90d9212ffb9c15ad0fbfe6c1aed8f03a77a5738',
  '2026-07-13.4':
    '03ba13509d9fd3d3a67043b572e457e29657591cd66491c769c66f1260c65e4b',
  '2026-07-13.5':
    '59142b62e9a4576d6de65b39f9aeb289fb836661538ea0911ca70a8fc1f4b657',
  '2026-07-13.6':
    '86193e6ec8bc99b2b44e7ada4889b9e02827eff9c616bdc8d2788bd07abae8af',
  '2026-07-13.7':
    'bcab0a1654923cd5f4949e064eab7218f3799df5db254c7f25d312638577fdc2',
  '2026-07-13.8':
    'b84ae225c8819c9eeb61035d6c7ec372f09253ca8154b9995876bcfcf90a9bf1',
  '2026-07-15.9':
    '715e873bd4a3f689cc755dd4606d5115d8b489b01b768fa69fc91527e46b5c99',
  '2026-07-15.10':
    '8c1860b29ff8232aaf660b96be67d5802797d8a54754dd5a65e6d3353dbbc449',
  '2026-07-15.11':
    'bc5b9ad381e5e2831b49b02809b64f68a06593fc2205163e22f783634d4b1047',
  '2026-07-15.12':
    '1c16a0f332f62ba2ce52498ae8fe964623d2b563396fb75885460a1241075c43',
  '2026-07-15.13':
    'cd466c85a72dccca73fa44487a73531af8d5103fc72c9a01fd0d3a08a1933abc',
  '2026-07-15.14':
    'bad61d3f506df8223c4e36609e6307691f8e6f670eb72179bb587bbb2522b510',
  '2026-07-15.15':
    '3acb2b4df57af3ae607aae559c3f3cd276b09ad847d66e110b6931f69c3af024',
  '2026-07-15.16':
    '103cc625a7266632115fdc744deb0c3ef8a5acfa9b09c5508f2da97076a6034f',
  '2026-07-15.17':
    '7285c430510e40a3b75d21c990f7ce9dcba8f8f68e9d9bdcdc19e6fb0d2c3b8f',
  '2026-07-15.18':
    'efa1c30e806bed596c4e6f4e75ab24697d38c832b39d43dba7fb4dc4e25a7cf8',
  '2026-07-15.19':
    '332feed943f9bcfc5397f13163d1afa4c536d5bd2f8a95632ea381c26404aba0',
} as const

function isDeeplyFrozen(value: unknown): boolean {
  return !value || typeof value !== 'object'
    ? true
    : Object.isFrozen(value) && Object.values(value).every(isDeeplyFrozen)
}

const errors = [
  ...validateFlowNodeRegistry(),
  ...Object.entries(GENERATION_MODEL_CONTRACTS).flatMap(([version, registry]) =>
    (version === GENERATION_MODEL_CONTRACT_VERSION
      ? validateHardenedGenerationRegistry(registry)
      : validateGenerationRegistry(registry)
    ).map(error => `${version}: ${error}`),
  ),
  ...validateGenerationCapabilityScenarios(),
]

const releasedVersions = Object.keys(GENERATION_MODEL_CONTRACTS).toSorted()
const protectedVersions = Object.keys(RELEASED_CONTRACT_HASHES).toSorted()
if (JSON.stringify(releasedVersions) !== JSON.stringify(protectedVersions)) {
  errors.push(
    'every released generation contract version must have exactly one immutable hash',
  )
}

for (const [version, expectedHash] of Object.entries(
  RELEASED_CONTRACT_HASHES,
)) {
  const contract
    = GENERATION_MODEL_CONTRACTS[
      version as keyof typeof GENERATION_MODEL_CONTRACTS
    ]
  const actualHash = createHash('sha256')
    .update(JSON.stringify(contract))
    .digest('hex')
  if (actualHash !== expectedHash)
    errors.push(`${version}: immutable historical contract hash changed`)
}
if (!isDeeplyFrozen(GENERATION_MODEL_CONTRACTS))
  errors.push('generation model contracts must be deeply frozen at runtime')

if (
  !areGenerationModelContractsEquivalent(
    'talelabs/seedance-2.0',
    '2026-07-13.7',
    '2026-07-15.11',
  )
) {
  errors.push(
    'catalog-only model metadata changes must not require a Flow-node update',
  )
}
if (
  areGenerationModelContractsEquivalent(
    'talelabs/seedream-4.5',
    '2026-07-15.13',
    '2026-07-15.14',
  )
) {
  errors.push(
    'Seedream output-size safety changes must require a Flow-node update',
  )
}
if (
  areGenerationModelContractsEquivalent(
    'talelabs/seedance-2.0',
    '2026-07-15.11',
    '2026-07-15.12',
  )
) {
  errors.push(
    'Seedance reference-limit changes must require a Flow-node update',
  )
}
if (
  areGenerationModelContractsEquivalent('talelabs/seedream-4.5', '2026-07-13.6')
) {
  errors.push(
    'creative capability changes must continue to require a Flow-node update',
  )
}
if (
  !areGenerationModelContractsEquivalent(
    'talelabs/seedream-4.5',
    '2026-07-15.12',
    '2026-07-15.13',
  )
) {
  errors.push(
    'execution availability changes must not require a Flow-node update',
  )
}

const gptImage2 = GENERATION_MODEL_REGISTRY['talelabs/gpt-image-2']
const seedance20 = GENERATION_MODEL_REGISTRY['talelabs/seedance-2.0']
const seedream45 = GENERATION_MODEL_REGISTRY['talelabs/seedream-4.5']
const nanoBananaPro = GENERATION_MODEL_REGISTRY['talelabs/nano-banana-pro']
const recraft41 = GENERATION_MODEL_REGISTRY['talelabs/recraft-4.1']
const veo31Current = GENERATION_MODEL_REGISTRY['talelabs/veo-3.1']
const grokVideo = GENERATION_MODEL_REGISTRY['talelabs/grok-imagine-video']
const seedreamAspectRatio = seedream45.settings.find(
  setting => setting.id === 'aspectRatio',
)
const seedreamResolution = seedream45.settings.find(
  setting => setting.id === 'resolution',
)
if (
  seedreamAspectRatio?.kind !== 'enum'
  || seedreamAspectRatio.options.some(option => option.value === 'auto')
  || seedreamResolution?.kind !== 'enum'
  || seedreamResolution.default !== '2K'
  || JSON.stringify(seedreamResolution.options.map(option => option.value))
  !== JSON.stringify(['2K', '4K'])
) {
  errors.push(
    'Seedream current settings must expose only provider-valid output sizes',
  )
}
const seedanceSlotLimits = Object.fromEntries(
  seedance20.inputSlots.map(slot => [slot.id, slot.maxItems]),
)
const seedanceReferenceOperation = seedance20.operations.find(
  operation => operation.id === 'referencesToVideo',
)
if (
  seedanceSlotLimits.imageReferences !== 9
  || seedanceSlotLimits.videoReferences !== 3
  || seedanceSlotLimits.audioReferences !== 3
  || seedanceReferenceOperation?.referenceLimit?.maxItems !== 15
) {
  errors.push(
    'Seedance current reference limits must match reviewed provider limits',
  )
}
const reviewedEnumValues = Object.fromEntries([
  nanoBananaPro,
  veo31Current,
  grokVideo,
  seedance20,
].map(model => [
  model.id,
  Object.fromEntries(model.settings
    .filter(setting => setting.kind === 'enum')
    .map(setting => [setting.id, setting.options.map(option => option.value)])),
]))
const nanoBananaProResolutions = JSON.stringify(
  reviewedEnumValues['talelabs/nano-banana-pro']?.resolution,
)
const veo31Resolutions = JSON.stringify(
  reviewedEnumValues['talelabs/veo-3.1']?.resolution,
)
const seedance20Resolutions = JSON.stringify(
  reviewedEnumValues['talelabs/seedance-2.0']?.resolution,
)
const grokAspectRatios = JSON.stringify(
  reviewedEnumValues['talelabs/grok-imagine-video']?.aspectRatio,
)
const grokDurations = JSON.stringify(
  reviewedEnumValues['talelabs/grok-imagine-video']?.durationSeconds,
)
if (nanoBananaProResolutions !== JSON.stringify(['1K', '2K', '4K'])) {
  errors.push('Nano Banana Pro must expose its reviewed 4K output tier')
}
if (veo31Resolutions !== JSON.stringify(['720p', '1080p', '4K'])) {
  errors.push('Veo 3.1 must use the reviewed OpenRouter resolution values')
}
if (seedance20Resolutions !== JSON.stringify(['480p', '720p', '1080p', '4K'])) {
  errors.push('Seedance 2.0 must use the reviewed OpenRouter resolution values')
}
const reviewedGrokAspectRatios = JSON.stringify([
  '16:9',
  '9:16',
  '1:1',
  '4:3',
  '3:4',
  '3:2',
  '2:3',
])
const reviewedGrokDurations = JSON.stringify([
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  '11',
  '12',
  '13',
  '14',
  '15',
])
if (
  grokAspectRatios !== reviewedGrokAspectRatios
  || grokDurations !== reviewedGrokDurations
) {
  errors.push('Grok Imagine Video must expose its reviewed ratios and durations')
}
const recraftImageToImage = recraft41.operations.find(
  operation => operation.id === 'imageToImage',
)
if (
  recraftImageToImage?.referenceLimit?.maxItems !== 1
  || recraft41.inputSlots.find(slot => slot.id === 'imageReferences')?.maxItems
  !== 1
) {
  errors.push('Recraft 4.1 must expose its reviewed single-reference operation')
}
if (Object.values(GENERATION_MODEL_REGISTRY).some(model =>
  Object.hasOwn(model, 'executionAvailable'))) {
  errors.push(
    'active catalog membership must replace field-based execution availability',
  )
}
const downgradedRegistry: Record<string, GenerationModelDefinition> = {
  ...GENERATION_MODEL_REGISTRY,
  [gptImage2.id]: {
    ...gptImage2,
    capabilitySchemaVersion: undefined,
    operations: gptImage2.operations.map((operation) => {
      const {
        output: _output,
        referenceLimit: _referenceLimit,
        ...legacy
      } = operation
      return legacy
    }),
    provider: { displayName: 'leaked', id: 'leaked' },
  },
}
if (!validateHardenedGenerationRegistry(downgradedRegistry).length)
  errors.push('hardened validation must reject a downgraded current contract')

const unavailableModel
  = GENERATION_MODEL_CONTRACTS['2026-07-13.1']['talelabs/gpt-image-1.5']
if ('talelabs/gpt-image-1.5' in GENERATION_MODEL_REGISTRY)
  errors.push('GPT Image 1.5 must not exist in the current generation catalog')
if (!unavailableModel) {
  errors.push(
    'GPT Image 1.5 must remain resolvable from its historical contract',
  )
}
for (const removedModelId of [
  'talelabs/ltx-2.3-pro',
  'talelabs/gpt-4o-mini-tts',
  'talelabs/eleven-multilingual-v2',
]) {
  if (removedModelId in GENERATION_MODEL_REGISTRY) {
    errors.push(`${removedModelId} must not exist in the current catalog`)
  }
  if (!(removedModelId in GENERATION_MODEL_CONTRACTS['2026-07-15.14'])) {
    errors.push(`${removedModelId} must remain historically resolvable`)
  }
}
for (const model of Object.values(GENERATION_MODEL_REGISTRY)) {
  if (model.mediaType !== 'text')
    continue
  if (
    model.inputSlots.some(slot => slot.id === 'instructions')
    || model.operations.some(operation =>
      operation.inputSlotIds.includes('instructions'))
  ) {
    errors.push(`${model.id}: current LLM contract exposes instructions input`)
  }
}
const historicalGpt55
  = GENERATION_MODEL_CONTRACTS['2026-07-15.18']['talelabs/gpt-5.5']
if (!historicalGpt55.inputSlots.some(slot => slot.id === 'instructions')) {
  errors.push('historical LLM instructions connector contract changed')
}
const unavailableRegistry: Record<string, GenerationModelDefinition> = {
  ...GENERATION_MODEL_REGISTRY,
  [unavailableModel.id]: unavailableModel,
}
if (
  !validateHardenedGenerationRegistry(unavailableRegistry).some(error =>
    error.includes('unavailable models must not exist'),
  )
) {
  errors.push('hardened validation must reject unavailable current models')
}

const impossibleReferenceRegistry: Record<string, GenerationModelDefinition> = {
  ...GENERATION_MODEL_REGISTRY,
  [gptImage2.id]: {
    ...gptImage2,
    operations: gptImage2.operations.map(operation =>
      operation.id === 'imageToImage'
        ? {
            ...operation,
            referenceLimit: { ...operation.referenceLimit, maxItems: 0 },
          }
        : operation,
    ),
  },
}
if (
  !validateHardenedGenerationRegistry(impossibleReferenceRegistry).some(
    error => error.includes('cannot satisfy required inputs'),
  )
) {
  errors.push('hardened validation must reject impossible reference limits')
}

if (errors.length)
  throw new Error(`Invalid generation registry:\n${errors.join('\n')}`)

console.log(
  'Generation registry and deterministic capability scenarios are valid',
)
