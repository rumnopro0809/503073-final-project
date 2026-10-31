export interface User { id: string; email: string; displayName: string; emailVerified: boolean; avatarUrl?: string | null; }
export class ApiError extends Error {
  constructor(message: string, public status: number, public fields: Record<string, string> = {}) { super(message); }
}
export interface ApiOptions { signal?: AbortSignal; method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; idempotencyKey?: string; }
export async function api<T>(url: string, body?: unknown, options: ApiOptions = {}): Promise<T> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (options.signal?.aborted) cancel();
  options.signal?.addEventListener('abort', cancel, { once: true });
  const timeout = window.setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(`/api${url}`, {
      method: options.method ?? (body === undefined ? 'GET' : 'POST'), credentials: 'same-origin', signal: controller.signal,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json', 'X-Requested-With': 'GhiChu' }),
        ...(options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (response.status === 204) return undefined as T;
    const data = await response.json();
    if (!response.ok) throw new ApiError(data.message || 'Chưa thể hoàn tất yêu cầu.', response.status, data.fields);
    return data as T;
  } catch (error) {
    if (options.signal?.aborted) throw new DOMException('Request cancelled', 'AbortError');
    if (error instanceof ApiError) throw error;
    throw new ApiError('Không kết nối được máy chủ. Bạn kiểm tra kết nối rồi thử lại nhé.', 0);
  } finally {
    window.clearTimeout(timeout);
    options.signal?.removeEventListener('abort', cancel);
  }
}
