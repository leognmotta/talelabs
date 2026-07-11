export interface RateLimitDecision {
  allowed: boolean
  limit: number
  remaining: number
  resetAt: number
}

export interface RateLimitStore {
  consume: (identifier: string) => Promise<RateLimitDecision>
}
