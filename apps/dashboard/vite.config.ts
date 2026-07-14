import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
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
    watch: {
      ignored: ['**/packages/*/dist/**'],
    },
  },
})
