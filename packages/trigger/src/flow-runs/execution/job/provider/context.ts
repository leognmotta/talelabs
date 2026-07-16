export interface GenerationJobProviderContext {
  callbackEnabled: boolean
  expectedOutputCount: number
  jobId: string
  mediaType: 'audio' | 'image' | 'text' | 'video'
  organizationId: string
}
