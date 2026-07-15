type RunEngineLogLevel = 'error' | 'info' | 'warn'

export function logRunEngine(
  level: RunEngineLogLevel,
  event: string,
  fields: Record<string, unknown> = {},
) {
  const payload = {
    event,
    layer: 'api',
    timestamp: new Date().toISOString(),
    ...fields,
  }
  if (level === 'error')
    console.error(payload)
  else if (level === 'warn')
    console.warn(payload)
  else
    console.log(payload)
}
