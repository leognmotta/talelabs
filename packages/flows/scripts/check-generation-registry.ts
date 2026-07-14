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
  )
) {
  errors.push(
    'catalog-only model metadata changes must not require a Flow-node update',
  )
}
if (
  areGenerationModelContractsEquivalent(
    'talelabs/seedream-4.5',
    '2026-07-13.6',
  )
) {
  errors.push(
    'creative capability changes must continue to require a Flow-node update',
  )
}

const gptImage2 = GENERATION_MODEL_REGISTRY['talelabs/gpt-image-2']
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
