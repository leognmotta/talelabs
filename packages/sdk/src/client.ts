export interface RequestConfig<TData = unknown> {
  url?: string
  method: 'GET' | 'PUT' | 'PATCH' | 'POST' | 'DELETE'
  params?: Record<string, unknown>
  data?: TData | FormData
  responseType?: 'arraybuffer' | 'blob' | 'document' | 'json' | 'text' | 'stream'
  signal?: AbortSignal
  headers?: HeadersInit
}

export interface ResponseConfig<TData = unknown> {
  data: TData
  status: number
  statusText: string
}

export type ResponseErrorConfig<TError = unknown> = TError

export type Client = <TData, _TError = unknown, TVariables = unknown>(
  config: RequestConfig<TVariables>,
) => Promise<ResponseConfig<TData>>

export class ApiError<TError = unknown> extends Error {
  readonly data: TError
  readonly status: number
  readonly statusText: string

  constructor(response: Response, data: TError) {
    super(`API request failed with ${response.status}`)
    this.name = 'ApiError'
    this.data = data
    this.status = response.status
    this.statusText = response.statusText
  }
}

function getApiBaseUrl() {
  const meta = import.meta as ImportMeta & {
    env?: {
      VITE_API_URL?: string
    }
  }

  return meta.env?.VITE_API_URL ?? 'http://localhost:3000'
}

function appendParams(url: URL, params?: Record<string, unknown>) {
  if (!params)
    return

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null)
      continue

    if (Array.isArray(value)) {
      for (const item of value)
        url.searchParams.append(key, String(item))
      continue
    }

    url.searchParams.set(key, String(value))
  }
}

const client: Client = async <TData, TError = unknown, TVariables = unknown>(
  config: RequestConfig<TVariables>,
) => {
  const url = new URL(config.url ?? '/', getApiBaseUrl())
  appendParams(url, config.params)

  const response = await fetch(url, {
    method: config.method,
    body: config.data instanceof FormData
      ? config.data
      : config.data === undefined
        ? undefined
        : JSON.stringify(config.data),
    credentials: 'include',
    headers: {
      ...(config.data instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...config.headers,
    },
    signal: config.signal,
  })

  const contentType = response.headers.get('content-type') ?? ''
  const data = contentType.includes('application/json')
    ? await response.json() as TData
    : await response.text() as TData

  if (!response.ok)
    throw new ApiError<TError>(response, data as unknown as TError)

  return {
    data,
    status: response.status,
    statusText: response.statusText,
  }
}

export default client
