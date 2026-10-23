import AwardsPage from '../src/features/discovery/AwardsPage';
import { DisplayProvider } from '../src/features/auth/DisplayProvider';
import { StrictMode, Fragment } from 'react';
// Test-only entry; never imported by src or included in normal build.
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext, type AuthState } from '../src/features/auth/context';
import { createApiClient, createApiTransport } from '../src/lib/api-client';
import { UpdateDialog } from '../src/components/UpdateDialog';
import { Layout } from '../src/app/Layout';
import HomePage from '../src/pages/HomePage';
import WelcomePage from '../src/pages/WelcomePage';
import AccountPage from '../src/features/auth/AccountPage';
import LibraryPage from '../src/features/library/LibraryPage';
import NotificationsPage from '../src/features/notifications/NotificationsPage';
import SavedPage from '../src/features/offline/SavedPage';
import ExplorePage from '../src/features/discovery/ExplorePage';
import ResultsPage from '../src/features/discovery/ResultsPage';
import SearchPage from '../src/features/discovery/SearchPage';
import SearchGate from '../src/features/auth/RequireSession';
import WorkPage from '../src/features/works/WorkPage';
import '../src/styles/global.css';
const entry = new URL(location.href).searchParams.get('entry') ?? '/explore';
const TestMode = new URL(location.href).searchParams.get('strict') === '1' ? StrictMode : Fragment;
const adminFixture = new URL(location.href).searchParams.get('role') === 'admin';
const auth: AuthState = {
  profile: {
    displayName: '架空の利用者',
    photoURL: 'https://lh3.googleusercontent.com/fixture-avatar',
  },
  offline: false,
  cacheSession: null,
  ready: true,
  configured: true,
  busy: false,
  error: '',
  signedIn: true,
  session: { version: '1', uid: 'fixture-alice', role: adminFixture ? 'admin' : 'student' },
  requestResponse: createApiTransport(async () => 'fixture-token'),
  request: createApiClient(async () => 'fixture-token'),
  login: () => {},
  logout: async () => {},
  deleteAccount: async () => {},
  retry: async () => {},
};
window.history.replaceState(null, '', entry);
createRoot(document.getElementById('root')!).render(
  <TestMode>
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <AuthContext.Provider value={auth}>
        <DisplayProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route
                  path="test-update"
                  element={
                    <UpdateDialog
                      onUpdate={async () => {
                        document.body.dataset.updateRequested = 'true';
                      }}
                    />
                  }
                />
                <Route
                  path="home"
                  element={
                    <SearchGate>
                      <HomePage />
                    </SearchGate>
                  }
                />
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="saved" element={<SavedPage />} />
                <Route path="welcome" element={<WelcomePage />} />
                <Route
                  path="search"
                  element={
                    <SearchGate>
                      <SearchPage />
                    </SearchGate>
                  }
                />
                <Route
                  path="results"
                  element={
                    <SearchGate>
                      <ResultsPage />
                    </SearchGate>
                  }
                />
                <Route path="account" element={<AccountPage />} />
                <Route path="library" element={<LibraryPage />} />
                <Route
                  path="explore/:categoryId?"
                  element={
                    <SearchGate>
                      <ExplorePage />
                    </SearchGate>
                  }
                />
                <Route
                  path="awards"
                  element={
                    <SearchGate>
                      <AwardsPage />
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
        </DisplayProvider>
      </AuthContext.Provider>
    </QueryClientProvider>
  </TestMode>,
);
