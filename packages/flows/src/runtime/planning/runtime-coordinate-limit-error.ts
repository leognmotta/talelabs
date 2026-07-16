export class RuntimeCoordinateLimitError extends RangeError {
  readonly code = 'runtime_coordinate_limit'
  readonly maximum: number

  constructor(maximum: number) {
    super(`Runtime coordinate count exceeds ${maximum}`)
    this.name = 'RuntimeCoordinateLimitError'
    this.maximum = maximum
  }
}
