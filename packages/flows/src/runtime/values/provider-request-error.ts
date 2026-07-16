export class GenerationProviderRequestMaterializationError extends TypeError {
  readonly code:
    | 'provider_request_asset_unresolved'
    | 'provider_request_text_unresolved'

  constructor(code: GenerationProviderRequestMaterializationError['code']) {
    super(code)
    this.code = code
    this.name = 'GenerationProviderRequestMaterializationError'
  }
}
