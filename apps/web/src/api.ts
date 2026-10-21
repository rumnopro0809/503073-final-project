export interface User { id: string; email: string; displayName: string; emailVerified: boolean; }
export class ApiError extends Error {
  constructor(message: string, public status: number, public fields: Record<string, string> = {}) { super(message); }
}
export async function api<T>(url: string, body?: unknown): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(`/api${url}`, {
      method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', signal: controller.signal,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json', 'X-Requested-With': 'GhiChu' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (response.status === 204) return undefined as T;
    const data = await response.json();
    if (!response.ok) throw new ApiError(data.message || 'Chưa thể hoàn tất yêu cầu.', response.status, data.fields);
    return data as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('Không kết nối được máy chủ. Bạn kiểm tra kết nối rồi thử lại nhé.', 0);
  } finally { window.clearTimeout(timeout); }
}
