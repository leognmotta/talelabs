/** Build-time dashboard composition and code-owned browser security policy. */

import type { Plugin } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const DASHBOARD_STORAGE_SOURCES = ['https://*.r2.cloudflarestorage.com']
const DASHBOARD_PRODUCTION_API_SOURCES = [
  'https://talelabs.ai',
  'https://*.talelabs.ai',
  'wss://talelabs.ai',
  'wss://*.talelabs.ai',
]

/**
 * Builds the document-delivered policy from reviewed public origin families.
 * The deployment response header separately owns `frame-ancestors`, which a
 * meta policy cannot enforce.
 */
function contentSecurityPolicy(mode: string) {
  const development = mode !== 'production'
  const connectSources = [
    '\'self\'',
    ...(development
      ? [
          'http://localhost:*',
          'http://127.0.0.1:*',
          'ws://localhost:*',
          'ws://127.0.0.1:*',
        ]
      : []),
    ...DASHBOARD_PRODUCTION_API_SOURCES,
    'https://api.trigger.dev',
    'wss://api.trigger.dev',
    'https://openrouter.ai',
    'https://*.openrouter.ai',
    ...DASHBOARD_STORAGE_SOURCES,
  ]
  return [
    'default-src \'self\'',
    'base-uri \'self\'',
    'object-src \'none\'',
    'script-src \'self\'',
    'style-src \'self\' \'unsafe-inline\'',
    'font-src \'self\' data:',
    `img-src 'self' data: blob: ${DASHBOARD_STORAGE_SOURCES.join(' ')}`,
    `media-src 'self' blob: ${DASHBOARD_STORAGE_SOURCES.join(' ')}`,
    `connect-src ${connectSources.join(' ')}`,
    'worker-src \'self\' blob:',
    'form-action \'self\'',
  ].join('; ')
}

/** Injects the document CSP while keeping the response-only policy at the edge. */
function contentSecurityPolicyPlugin(policy: string): Plugin {
  return {
    name: 'talelabs-content-security-policy',
    transformIndexHtml: {
      handler: html => html.replace('%TALELABS_CSP%', policy),
      order: 'pre',
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const policy = contentSecurityPolicy(mode)
  return {
    plugins: [contentSecurityPolicyPlugin(policy), react(), tailwindcss()],
    resolve: {
      alias: [
        {
          find: '@talelabs/i18n/catalogs',
          replacement: fileURLToPath(new URL('../../packages/i18n/src/catalogs.ts', import.meta.url)),
        },
        {
          find: '@talelabs/assets',
          replacement: fileURLToPath(new URL('../../packages/assets/src/index.ts', import.meta.url)),
        },
        {
          find: '@talelabs/elements',
          replacement: fileURLToPath(new URL('../../packages/elements/src/index.ts', import.meta.url)),
        },
        {
          find: '@talelabs/flows',
          replacement: fileURLToPath(new URL('../../packages/flows/src/index.ts', import.meta.url)),
        },
        {
          find: '@talelabs/i18n',
          replacement: fileURLToPath(new URL('../../packages/i18n/src/index.ts', import.meta.url)),
        },
        {
          find: '@',
          replacement: fileURLToPath(new URL('./src', import.meta.url)),
        },
      ],
    },
    server: {
      headers: {
        'Content-Security-Policy': 'frame-ancestors \'none\'',
        'X-Frame-Options': 'DENY',
      },
      watch: {
        ignored: ['**/packages/*/dist/**'],
      },
    },
    preview: {
      headers: {
        'Content-Security-Policy': 'frame-ancestors \'none\'',
        'X-Frame-Options': 'DENY',
      },
    },
  }
})
