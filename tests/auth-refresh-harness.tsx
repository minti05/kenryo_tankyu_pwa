import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { AuthProvider } from '../src/features/auth/AuthProvider';
import RequireSession from '../src/features/auth/RequireSession';
import { useAuth } from '../src/features/auth/context';
function Probe() {
  const { session, request, logout } = useAuth();
  const [mount] = useState(() => crypto.randomUUID());
  const data = useQuery({
    queryKey: ['probe', session?.uid],
    queryFn: () => request('/api/probe'),
    staleTime: Infinity,
  });
  return (
    <div>
      <span data-testid="mount">{mount}</span>
      <span data-testid="uid">{session?.uid}</span>
      <span data-testid="role">{session?.role}</span>
      <input aria-label="読みかけのメモ" />
      <span data-testid="loaded">{data.isSuccess ? 'loaded' : 'loading'}</span>
      <button onClick={() => void logout()}>ログアウト</button>
    </div>
  );
}
createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <BrowserRouter>
      <AuthProvider>
        <RequireSession>
          <Probe />
        </RequireSession>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>,
);
