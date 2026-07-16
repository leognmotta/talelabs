export class CanonicalSerializationError extends TypeError {
  readonly path: string

  constructor(message: string, path: string) {
    super(`${message} at ${path}`)
    this.name = 'CanonicalSerializationError'
    this.path = path
  }
}
