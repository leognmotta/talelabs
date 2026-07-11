import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { ffmpeg } from '@trigger.dev/build/extensions/core'
import { defineConfig } from '@trigger.dev/sdk'
import { config } from 'dotenv'

config({ path: fileURLToPath(new URL('.env', import.meta.url)) })

const project = process.env.TRIGGER_PROJECT_REF

if (!project)
  throw new Error('TRIGGER_PROJECT_REF is required to configure Trigger.dev.')

export default defineConfig({
  project,
  dirs: ['./packages/trigger/src/tasks'],
  runtime: 'node-22',
  logLevel: 'info',
  maxDuration: 600,
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
    },
  },
  build: {
    extensions: [ffmpeg({ version: '7' })],
  },
})
