import { API_URL, REQUEST_TIMEOUT_MS } from './config';

export class ApiError extends Error {
  constructor(
    /** 0 = network error / timeout */
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
  get isNetwork() { return this.status === 0; }
  get isUnauthorized() { return this.status === 401; }
  /** Worth retrying later (network, rate limit, server error). */
  get isTransient() { return this.status === 0 || this.status === 429 || this.status >= 500; }
}

export async function apiRequest<T>(path: string, options: { method?: string; body?: unknown; token?: string | null } = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(options.body !== undefined && { 'Content-Type': 'application/json' }),
        ...(options.token && { Authorization: `Bearer ${options.token}` }),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch (e) {
    const timedOut = (e as Error)?.name === 'AbortError';
    throw new ApiError(0, timedOut ? 'timeout' : 'network', timedOut ? 'Request timed out' : 'Network request failed');
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = data?.error ?? {};
    throw new ApiError(res.status, err.code ?? 'http_error', err.message ?? `HTTP ${res.status}`);
  }
  return data as T;
}
