import { fileURLToPath } from 'node:url'
import antfu from '@antfu/eslint-config'
import betterTailwindcss from 'eslint-plugin-better-tailwindcss'

const projectRoot = fileURLToPath(new URL('.', import.meta.url))

export default antfu({
  react: true,
  typescript: true,
  ignores: [
    '**/dist',
    '**/dist-ssr',
    '**/.next',
    '**/.turbo',
    '**/node_modules',
    '**/*.tsbuildinfo',
    'packages/models-catalog/models.json',
    'packages/sdk/openapi.json',
    'packages/sdk/src/gen',
  ],
}, {
  files: ['**/*.{ts,tsx}'],
  rules: {
    'ts/consistent-type-definitions': ['error', 'interface'],
  },
}, {
  files: [
    'apps/dashboard/**/*.{ts,tsx}',
    'packages/ui/src/**/*.{ts,tsx}',
  ],
  plugins: {
    'better-tailwindcss': betterTailwindcss,
  },
  settings: {
    'better-tailwindcss': {
      cwd: projectRoot,
      entryPoint: 'packages/ui/src/styles/globals.css',
    },
  },
  rules: {
    ...betterTailwindcss.configs.recommended.rules,
  },
}, {
  files: [
    'apps/api/**/*.ts',
    'packages/auth/**/*.ts',
    'packages/db/**/*.ts',
  ],
  rules: {
    'no-console': ['error', { allow: ['log', 'warn', 'error'] }],
    'node/prefer-global/process': 'off',
  },
}, {
  files: ['packages/ui/src/**/*.{ts,tsx}'],
  rules: {
    'better-tailwindcss/no-unknown-classes': 'off',
    'eqeqeq': 'off',
    'react/dom-no-dangerously-set-innerhtml': 'off',
    'react/no-array-index-key': 'off',
    'react/no-context-provider': 'off',
    'react/no-nested-component-definitions': 'off',
    'react/no-use-context': 'off',
    'react/set-state-in-effect': 'off',
    'react/use-state': 'off',
    'react-refresh/only-export-components': 'off',
  },
})
