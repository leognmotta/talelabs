import { defineConfig } from '@kubb/core'
import { pluginClient } from '@kubb/plugin-client'
import { pluginOas } from '@kubb/plugin-oas'
import { pluginReactQuery } from '@kubb/plugin-react-query'
import { pluginTs } from '@kubb/plugin-ts'
import { pluginZod } from '@kubb/plugin-zod'

export default defineConfig({
  root: '.',
  input: {
    path: './openapi.json',
  },
  output: {
    path: './src/gen',
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
        path: './types',
      },
    }),
    pluginZod({
      output: {
        path: './zod',
      },
      importPath: 'zod',
      typed: true,
    }),
    pluginClient({
      output: {
        path: './clients',
      },
      importPath: '../../client',
      dataReturnType: 'data',
      parser: 'zod',
      paramsType: 'object',
    }),
    pluginReactQuery({
      output: {
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
