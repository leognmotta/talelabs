import type { ElementType } from '@talelabs/elements'

export interface BuiltElementContext {
  assets: Array<{
    assetId: string
    isPrimary: boolean
    mediaType: 'audio' | 'image' | 'video'
    mimeType: string
    role: string
    sortOrder: number
  }>
  elementId: string
  schemaVersion: number
  text: string
  type: ElementType
}

export interface ElementContextBuilderInput<Data extends Record<string, unknown>> {
  assets: BuiltElementContext['assets']
  data: Data
  elementId: string
  name: string
  schemaVersion: number
}

export interface OtherElementContextBuilderInput<
  Data extends Record<string, unknown>,
> extends ElementContextBuilderInput<Data> {
  instructions: null | string
}

export type ElementContextBuilder<Data extends Record<string, unknown>> = (
  input: ElementContextBuilderInput<Data>,
) => BuiltElementContext

export type OtherElementContextBuilder<Data extends Record<string, unknown>> = (
  input: OtherElementContextBuilderInput<Data>,
) => BuiltElementContext
