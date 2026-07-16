import type {
  NormalizedGenerationOutput,
  NormalizedGenerationRequest,
} from '@talelabs/flows'

function mockText(request: NormalizedGenerationRequest, outputIndex: number) {
  const semanticText = request.textSlots
    .map(slot => `${slot.slotId}: ${slot.resolvedText}`)
    .join('\n')
  return [
    'TaleLabs deterministic mock output.',
    `Job: ${request.requestId}`,
    `Node: ${request.nodeId}`,
    `Model: ${request.productModelId}`,
    `Operation: ${request.operationId}`,
    `Hash: ${request.requestPayloadHash.slice(0, 16)}`,
    `Output: ${outputIndex}`,
    semanticText,
  ].filter(Boolean).join('\n')
}

export async function createDeterministicMockTextOutput(
  request: NormalizedGenerationRequest,
  outputIndex: number,
): Promise<NormalizedGenerationOutput> {
  return {
    mediaType: 'text',
    outputIndex,
    payload: {
      delivery: 'text',
      mimeType: 'text/plain',
      text: mockText(request, outputIndex),
    },
  }
}
