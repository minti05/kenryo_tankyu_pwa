// Test-only entry; never imported by src or included in normal build.
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext, type AuthState } from '../src/features/auth/context';
import { createApiClient, createApiTransport } from '../src/lib/api-client';
import { Layout } from '../src/app/Layout';
import SearchPage from '../src/features/discovery/SearchPage';
import SearchGate from '../src/features/auth/RequireSession';
import WorkPage from '../src/features/works/WorkPage';
import '../src/styles/global.css';
const entry = new URL(location.href).searchParams.get('entry') ?? '/explore';
const auth: AuthState = {
  offline: false,
  cacheSession: null,
  ready: true,
  configured: true,
  busy: false,
  error: '',
  signedIn: true,
  session: { version: '1', uid: 'fixture-alice', role: 'student' },
  requestResponse: createApiTransport(async () => 'fixture-token'),
  request: createApiClient(async () => 'fixture-token'),
  login: () => {},
  logout: async () => {},
  retry: async () => {},
};
window.history.replaceState(null, '', entry);
createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <AuthContext.Provider value={auth}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route
              path="explore"
              element={
                <SearchGate>
                  <SearchPage />
                </SearchGate>
              }
            />
            <Route
              path="awards"
              element={
                <SearchGate>
                  <SearchPage awards />
                </SearchGate>
              }
            />
            <Route
              path="works/:id"
              element={
                <SearchGate>
                  <WorkPage />
                </SearchGate>
              }
            />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  </QueryClientProvider>,
);
