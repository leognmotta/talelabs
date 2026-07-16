/** Stable text result used by every debug-mode text generation job. */

import type {
  NormalizedGenerationOutput,
} from '@talelabs/flows'

const MOCK_TEXT_OUTPUT = 'TaleLabs debug mode returned this deterministic mock text output.'

/** Creates the stable text output returned by every debug-mode text job. */
export async function createDeterministicMockTextOutput(
  outputIndex: number,
): Promise<NormalizedGenerationOutput> {
  return {
    mediaType: 'text',
    outputIndex,
    payload: {
      delivery: 'text',
      mimeType: 'text/plain',
      text: MOCK_TEXT_OUTPUT,
    },
  }
}
