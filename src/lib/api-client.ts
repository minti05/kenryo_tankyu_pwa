export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}
/** 認証を接続するT05の入口。トークンなしでは通信自体を行わない。 */
export function createApiTransport(getToken: () => Promise<string | null>) {
  return async function request(path: string, options: RequestInit = {}): Promise<Response> {
    if (
      !/^\/api\//.test(path) ||
      path.includes('\\') ||
      !new URL(path, window.location.origin).pathname.startsWith('/api/')
    )
      throw new ApiError(0, 'invalid_api_path');
    const token = await getToken();
    if (!token) throw new ApiError(401, 'authentication_required');
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${token}`);
    if (typeof options.body === 'string' && !headers.has('Content-Type'))
      headers.set('Content-Type', 'application/json');
    if (!headers.has('Accept')) headers.set('Accept', 'application/json');
    const response = await fetch(path, {
      ...options,
      headers,
      cache: 'no-store',
      redirect: 'error',
    });
    if (!response.ok) {
      let code = response.status === 401 ? 'session_expired' : 'request_failed';
      try {
        const data = await response.json();
        if (typeof data?.error?.code === 'string' && /^[a-z_]{1,64}$/.test(data.error.code))
          code = data.error.code;
      } catch {
        /* APIがJSONを返さない場合も内部情報を画面へ出さない。 */
      }
      throw new ApiError(response.status, code);
    }
    return response;
  };
}
export function createApiClient(getToken: () => Promise<string | null>) {
  const transport = createApiTransport(getToken);
  return async <T>(path: string, options: RequestInit = {}): Promise<T> => {
    const response = await transport(path, options);
    if (!response.headers.get('content-type')?.includes('application/json'))
      throw new ApiError(response.status, 'invalid_response');
    return response.json() as Promise<T>;
  };
}
