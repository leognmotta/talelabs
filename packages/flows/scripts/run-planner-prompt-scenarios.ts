/** Structured-prompt planning, invalidation, override, and resolution scenarios. */

import type { PlannedJobRequestPayloadV6 } from '../src/index.js'
import {
  hashFlowRunJob,
  materializeGenerationProviderRequest,
  planFlowRun,
  readFlowRunJobRequestPayload,
  selectedProviderRequestInputs,
} from '../src/index.js'
import {
  expectRunPlanner as expect,
  expectRunPlannerFailure as expectFailure,
  expectRunPlannerSuccess as expectSuccess,
} from './run-planner-assertions.js'
import { edge, generationNode, sourceNode } from './run-planner-graph-fixtures.js'

const referencedPrompt = {
  parts: [
    { text: 'Use ', type: 'text' as const },
    {
      index: 0,
      mediaType: 'image' as const,
      slotId: 'imageReferences',
      type: 'input' as const,
    },
    { text: ' as the character.', type: 'text' as const },
  ],
  version: 1 as const,
}

function legacyStructuredRequest(
  request: PlannedJobRequestPayloadV6,
  version: 3 | 4,
) {
  const base = {
    catalogRevision: request.catalogRevision,
    catalogVersion: request.catalogVersion,
    inline: request.inline,
    inputSelections: request.inputSelections,
    inputs: request.inputs.map(input => ({
      edgeId: input.bindingId,
      items: input.items,
      sourceHandleId: input.sourceOutputId,
      sourceNodeId: input.sourceId,
      targetHandleId: input.targetSlotId,
    })),
    itemKey: request.itemKey,
    modelContractVersion: request.modelContractVersion,
    modelId: request.modelId,
    modelRevision: request.modelRevision,
    nodeId: request.executionStepId,
    operationId: request.operationId,
    outputCount: request.outputCount,
    requestIndex: request.requestIndex,
    settings: request.settings,
  }
  return version === 3
    ? { ...base, requestPayloadVersion: 3 as const }
    : {
        ...base,
        inputLimits: request.inputLimits,
        promptTemplates: request.promptTemplates,
        requestPayloadVersion: 4 as const,
      }
}

function promptFlow(prompt: typeof referencedPrompt) {
  return {
    command: { mode: 'node' as const, targetNodeId: 'prompt-target' },
    context: {
      assetTypesById: { 'asset-character': 'image' as const },
      elementReferencesById: {},
    },
    flow: {
      edges: [
        edge(
          '01',
          'prompt-image',
          'prompt-target',
          'asset',
          'imageReferences',
        ),
      ],
      id: 'flow-structured-prompt',
      nodes: [
        sourceNode('prompt-image', 'asset', 'asset-character'),
        generationNode('prompt-target', 'imageGeneration', {
          operationId: 'imageToImage',
          prompt,
        }),
      ],
      revision: 1,
    },
  }
}

/** Verifies the prompt template remains provider-neutral and exact. */
export function verifyRunPlannerPromptScenarios() {
  const historicalNode = generationNode('historical-prompt', 'llm')
  const historicalPlan = expectSuccess(planFlowRun({
    command: { mode: 'node', targetNodeId: historicalNode.id },
    context: { assetTypesById: {}, elementReferencesById: {} },
    flow: {
      edges: [],
      id: 'flow-historical-string-prompt',
      nodes: [{
        ...historicalNode,
        data: { ...historicalNode.data, prompt: 'Historical prompt' },
        schemaVersion: 1,
      }],
      revision: 1,
    },
  }), 'historical string prompt upcast')
  expect(
    historicalPlan?.executionNodes[0]?.workItems[0]?.requestShards[0]
      ?.requestPayload
      .promptTemplates
      ?.prompt
      .parts[0]
      ?.type === 'text',
    'historical string prompts must upcast into the narrow prompt template',
  )

  const plan = expectSuccess(
    planFlowRun(promptFlow(referencedPrompt)),
    'structured prompt reference',
  )
  if (plan) {
    const shard = plan.executionNodes[0]!.workItems[0]!.requestShards[0]!
    expect(
      shard.requestPayload.requestPayloadVersion === 6
      && Boolean(shard.requestPayload.inputLimits)
      && Boolean(shard.requestPayload.promptTemplates),
      'structured prompt requests must use the shared compiler v6 contract',
    )
    if (shard.requestPayload.requestPayloadVersion !== 6)
      throw new Error('planner must emit request payload v6')
    const legacyRequest = legacyStructuredRequest(shard.requestPayload, 3)
    expect(
      readFlowRunJobRequestPayload({
        requestHash: hashFlowRunJob(legacyRequest),
        requestPayload: legacyRequest,
      }).requestPayloadVersion === 3,
      'the immutable request reader must retain strict v3 compatibility',
    )
    const incompleteV4Request = {
      ...legacyStructuredRequest(shard.requestPayload, 4),
      promptTemplates: undefined,
    }
    let incompleteV4Rejected = false
    try {
      readFlowRunJobRequestPayload({
        requestHash: hashFlowRunJob(incompleteV4Request),
        requestPayload: incompleteV4Request,
      })
    }
    catch (error) {
      incompleteV4Rejected = error instanceof Error
        && 'code' in error
        && error.code === 'job_request_invalid'
    }
    expect(
      incompleteV4Rejected,
      'v4 requests must reject missing structured prompt fields',
    )
    const request = materializeGenerationProviderRequest({
      requestId: 'structured-prompt-job',
      requestPayload: shard.requestPayload,
    })
    const prompt = request.textSlots.find(slot => slot.slotId === 'prompt')
    expect(
      prompt?.resolvedText === 'Use reference image 1 as the character.',
      'structured prompt tokens must resolve to deterministic provider text',
    )
    expect(
      prompt?.inputReferences[0]?.assetId === 'asset-character'
      && prompt.inputReferences[0]?.slotId === 'imageReferences'
      && prompt.inputReferences[0]?.index === 0,
      'structured prompt resolution must retain exact token-to-Asset mapping',
    )
    expect(
      shard.requestPayload.promptTemplates?.prompt.parts[1]?.type === 'input',
      'the immutable job payload must retain the narrow prompt template',
    )
  }

  const invalidPrompt = {
    ...referencedPrompt,
    parts: referencedPrompt.parts.map(part => part.type === 'input'
      ? { ...part, index: 1 }
      : part),
  }
  expectFailure(
    planFlowRun(promptFlow(invalidPrompt)),
    'prompt_input_missing',
    'out-of-range structured prompt reference',
  )

  const duplicateAssetInput = promptFlow(invalidPrompt)
  const duplicateAssetPlan = expectSuccess(
    planFlowRun({
      ...duplicateAssetInput,
      flow: {
        ...duplicateAssetInput.flow,
        edges: [
          ...duplicateAssetInput.flow.edges,
          edge(
            '02',
            'prompt-image-copy',
            'prompt-target',
            'asset',
            'imageReferences',
          ),
        ],
        id: 'flow-duplicate-prompt-asset',
        nodes: [
          ...duplicateAssetInput.flow.nodes,
          sourceNode('prompt-image-copy', 'asset', 'asset-character'),
        ],
      },
    }),
    'duplicate Asset connections retain distinct prompt positions',
  )
  if (duplicateAssetPlan) {
    const duplicateShard = duplicateAssetPlan.executionNodes[0]!
      .workItems[0]!
      .requestShards[0]!
    const duplicateRequest = materializeGenerationProviderRequest({
      requestId: 'duplicate-prompt-asset-job',
      requestPayload: duplicateShard.requestPayload,
    })
    const duplicatePrompt = duplicateRequest.textSlots.find(
      slot => slot.slotId === 'prompt',
    )
    expect(
      duplicatePrompt?.resolvedText
      === 'Use reference image 2 as the character.'
      && duplicatePrompt.inputReferences[0]?.assetId === 'asset-character'
      && duplicatePrompt.inputReferences[0]?.index === 1,
      'the second connector occurrence must resolve as prompt input index 1',
    )
    if (duplicateShard.requestPayload.requestPayloadVersion === 6) {
      const legacyV4Payload = legacyStructuredRequest(
        duplicateShard.requestPayload,
        4,
      )
      const legacyV4AssetCount = selectedProviderRequestInputs(legacyV4Payload)
        .flatMap(input => input.items)
        .flatMap(item => item.value.kind === 'text' ? [] : item.value.assets)
        .length
      expect(
        readFlowRunJobRequestPayload({
          requestHash: hashFlowRunJob(legacyV4Payload),
          requestPayload: legacyV4Payload,
        }).requestPayloadVersion === 4
        && legacyV4AssetCount === 1,
        'v4 retries must retain their historical Asset-deduplicating behavior',
      )
    }
    else {
      expect(false, 'duplicate Asset requests must use payload version 6')
    }
  }

  const connectedOverride = expectSuccess(planFlowRun({
    ...promptFlow(invalidPrompt),
    flow: {
      ...promptFlow(invalidPrompt).flow,
      edges: [
        ...promptFlow(invalidPrompt).flow.edges,
        edge('02', 'prompt-text', 'prompt-target', 'text', 'prompt'),
      ],
      id: 'flow-connected-prompt-override',
      nodes: [
        sourceNode('prompt-image', 'asset', 'asset-character'),
        sourceNode('prompt-text', 'text', null),
        generationNode('prompt-target', 'imageGeneration', {
          operationId: 'imageToImage',
          prompt: invalidPrompt,
        }),
      ],
    },
  }), 'connected prompt override')
  if (!connectedOverride)
    return
  const shard = connectedOverride.executionNodes[0]!
    .workItems[0]!
    .requestShards[0]!
  const request = materializeGenerationProviderRequest({
    requestId: 'connected-prompt-job',
    requestPayload: shard.requestPayload,
  })
  const prompt = request.textSlots.find(slot => slot.slotId === 'prompt')
  expect(
    prompt?.source === 'connected'
    && prompt.resolvedText === 'text:prompt-text'
    && prompt.inputReferences.length === 0,
    'connected Text must override the inline template without resolving its tokens',
  )
}
