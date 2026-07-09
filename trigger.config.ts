import process from 'node:process'
import { defineConfig } from '@trigger.dev/sdk'
import { config } from 'dotenv'

config()

const project = process.env.TRIGGER_PROJECT_REF

if (!project)
  throw new Error('TRIGGER_PROJECT_REF is required to configure Trigger.dev.')

export default defineConfig({
  project,
  dirs: ['./trigger'],
  runtime: 'node',
  logLevel: 'info',
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
    },
  },
})
