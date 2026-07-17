/** Deterministic preview output projection for mocked generation requests. */

import type { TFunction } from 'i18next'
import type { FlowGenerationPreviewOutput } from '../editor/flow-canvas-types'
import type {
  GenerationMockRequest,
  MediaMockRequest,
} from './flow-generation-preview-request'

import { fingerprintGenerationMockRequest } from './flow-generation-preview-fingerprint'

function escapeSvgText(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&apos;')
}

function createMediaPreviewSvg(request: MediaMockRequest, name: string) {
  const colors = {
    audio: ['#2a1804', '#f59e0b'],
    image: ['#25102d', '#a855f7'],
    video: ['#071d36', '#3b82f6'],
  } as const
  const [background, accent] = colors[request.mediaType]
  const safeName = escapeSvgText(name)
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${background}"/><stop offset="1" stop-color="#080b12"/></linearGradient></defs>
  <rect width="1280" height="720" fill="url(#g)"/>
  <circle cx="640" cy="320" r="96" fill="none" stroke="${accent}" stroke-width="4" opacity=".7"/>
  <path d="M580 320h120M605 292v56M635 275v90M665 292v56" stroke="${accent}" stroke-width="10" stroke-linecap="round" opacity=".9"/>
  <text x="640" y="480" fill="#f8fafc" font-family="system-ui, sans-serif" font-size="42" text-anchor="middle">${safeName}</text>
</svg>`
}

/**
 * Builds the localized text or deterministic SVG output consumed by the mock
 * runtime while retaining the request fingerprint in text download names.
 */
export function createGenerationMockOutput(
  request: GenerationMockRequest,
  t: TFunction,
): FlowGenerationPreviewOutput {
  const name = t(request.labelKey)
  if (request.kind === 'text') {
    const text = [
      t('flows.llm.mock.output', {
        count: request.imageAssetIds.length,
        prompt: request.prompt,
      }),
      ...(request.instructions
        ? [t('flows.llm.mock.instructionsApplied', {
            instructions: request.instructions,
          })]
        : []),
    ].join('\n\n')
    return {
      download: {
        content: text,
        fileName: `talelabs-text-${fingerprintGenerationMockRequest(request)}.txt`,
        mimeType: 'text/plain;charset=utf-8',
      },
      kind: 'text',
      name,
      text,
      valueType: 'Text',
    }
  }

  return {
    download: {
      content: createMediaPreviewSvg(request, name),
      fileName: `talelabs-${request.mediaType}-${request.nodeId}.svg`,
      mimeType: 'image/svg+xml;charset=utf-8',
    },
    kind: 'media',
    mediaType: request.mediaType,
    name,
    valueType: request.outputValueType,
  }
}
