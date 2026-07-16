import { logger } from '@trigger.dev/sdk'

type RunEngineLogLevel = 'error' | 'info' | 'warn'

export function logRunEngine(
  level: RunEngineLogLevel,
  event: string,
  fields: Record<string, unknown> = {},
) {
  const payload = {
    event,
    layer: 'trigger',
    timestamp: new Date().toISOString(),
    ...fields,
  }
  if (level === 'error') {
    logger.error(event, payload)
  }
  else if (level === 'warn') {
    logger.warn(event, payload)
  }
  else {
    logger.info(event, payload)
  }
}
