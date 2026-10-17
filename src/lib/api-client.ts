export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}
/** 認証を接続するT05の入口。トークンなしでは通信自体を行わない。 */
export function createApiClient(getToken: () => Promise<string | null>) {
  return async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    if (!/^\/api\//.test(path) || path.startsWith('//')) throw new ApiError(0, 'invalid_api_path');
    const token = await getToken();
    if (!token) throw new ApiError(401, 'authentication_required');
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('Accept', 'application/json');
    const response = await fetch(path, {
      ...options,
      headers,
      cache: 'no-store',
      redirect: 'error',
    });
    if (!response.ok)
      throw new ApiError(
        response.status,
        response.status === 401 ? 'session_expired' : 'request_failed',
      );
    if (!response.headers.get('content-type')?.includes('application/json'))
      throw new ApiError(response.status, 'invalid_response');
    return response.json() as Promise<T>;
  };
}
