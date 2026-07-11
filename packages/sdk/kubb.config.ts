import process from 'node:process'
import { defineConfig } from '@kubb/core'
import { pluginClient } from '@kubb/plugin-client'
import { pluginOas } from '@kubb/plugin-oas'
import { pluginReactQuery } from '@kubb/plugin-react-query'
import { pluginTs } from '@kubb/plugin-ts'
import { pluginZod } from '@kubb/plugin-zod'

const outputPath = process.env.TALELABS_SDK_OUTPUT_PATH ?? './src/gen'

export default defineConfig({
  root: '.',
  input: {
    path: './openapi.json',
  },
  output: {
    barrelType: 'all',
    path: outputPath,
    clean: true,
    format: 'prettier',
  },
  plugins: [
    pluginOas({
      validate: true,
      generators: [],
    }),
    pluginTs({
      output: {
        barrelType: 'all',
        path: './types',
      },
    }),
    pluginZod({
      output: {
        barrelType: 'all',
        path: './zod',
      },
      importPath: 'zod',
      typed: true,
    }),
    pluginClient({
      output: {
        barrelType: 'all',
        path: './clients',
      },
      importPath: '../../client',
      dataReturnType: 'data',
      parser: 'zod',
      paramsType: 'object',
    }),
    pluginReactQuery({
      output: {
        barrelType: 'all',
        path: './hooks',
      },
      client: {
        importPath: '../../client',
        dataReturnType: 'data',
      },
      parser: 'zod',
      paramsType: 'object',
      query: {
        importPath: '@tanstack/react-query',
      },
      mutation: false,
      suspense: false,
      infinite: false,
    }),
  ],
})
