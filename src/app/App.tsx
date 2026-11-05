import { LoadingIndicator } from '../components/Loading';
import { StartupHandoff } from '../components/StartupHandoff';
import '../lib/theme';
import { Component, lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from './Layout';
import { PREVIEW_ENABLED } from '../lib/environment';
import WelcomePage from '../pages/WelcomePage';
import { AuthProvider } from '../features/auth/AuthProvider';
const LegalPage = lazy(() => import('../pages/LegalPage'));
const ContactPage = lazy(() => import('../pages/ContactPage'));
const HomePage = lazy(() => import('../pages/HomePage'));
const NotificationsPage = lazy(() => import('../features/notifications/NotificationsPage'));
const LibraryPage = lazy(() => import('../features/library/LibraryPage'));
const SavedPage = lazy(() => import('../features/offline/SavedPage'));
const NaturalSearchPage = lazy(() => import('../features/discovery/NaturalSearchPage'));
const SearchPage = lazy(() => import('../features/discovery/SearchPage'));
const SearchGate = lazy(() => import('../features/auth/RequireSession'));
const WorkPage = lazy(() => import('../features/works/WorkPage'));
const AccountPage = lazy(() => import('../features/auth/AccountPage'));
const ExplorePage = lazy(() => import('../features/discovery/ExplorePage'));
const AwardsPage = lazy(() => import('../features/discovery/AwardsPage'));
const ResultsPage = lazy(() => import('../features/discovery/ResultsPage'));
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'));
const preview = PREVIEW_ENABLED
  ? {
      Frame: lazy(() => import('@preview-routes').then((m) => ({ default: m.PreviewFrame }))),
      Explore: lazy(() => import('@preview-routes').then((m) => ({ default: m.ExplorePage }))),
      Library: lazy(() => import('@preview-routes').then((m) => ({ default: m.LibraryPage }))),
      Work: lazy(() => import('@preview-routes').then((m) => ({ default: m.WorkPage }))),
    }
  : null;
const client = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, staleTime: 60000 } },
});
class PageBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <StartupHandoff>
        <div className="page-container empty-state">
          <h1>画面を読み込めませんでした。</h1>
          <p>もう一度お試しください。</p>
          <button className="button primary" onClick={() => window.location.reload()}>
            読み直す
          </button>
        </div>
      </StartupHandoff>
    ) : (
      this.props.children
    );
  }
}
export default function App() {
  return (
    <QueryClientProvider client={client}>
      <AuthProvider>
        <BrowserRouter>
          <PageBoundary>
            <Suspense
              fallback={<LoadingIndicator className="loading-state" label="画面を読み込み中" />}
            >
              <StartupHandoff>
                <Routes>
                  <Route element={<Layout />}>
                    <Route index element={<Navigate to="/welcome" replace />} />
                    <Route path="privacy" element={<LegalPage kind="privacy" />} />
                    <Route path="terms" element={<LegalPage kind="terms" />} />
                    <Route path="contact" element={<ContactPage />} />
                    <Route path="welcome" element={<WelcomePage />} />
                    <Route
                      path="home"
                      element={
                        <SearchGate>
                          <HomePage />
                        </SearchGate>
                      }
                    />
                    <Route
                      path="search"
                      element={
                        <SearchGate>
                          <SearchPage />
                        </SearchGate>
                      }
                    />
                    <Route
                      path="search/chat"
                      element={
                        <SearchGate>
                          <NaturalSearchPage />
                        </SearchGate>
                      }
                    />
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
                    <Route
                      path="saved"
                      element={
                        <SearchGate>
                          <SavedPage />
                        </SearchGate>
                      }
                    />
                    <Route
                      path="library"
                      element={
                        <SearchGate>
                          <LibraryPage />
                        </SearchGate>
                      }
                    />
                    <Route
                      path="notifications"
                      element={
                        <SearchGate>
                          <NotificationsPage />
                        </SearchGate>
                      }
                    />
                    <Route path="account" element={<AccountPage />} />
                    <Route
                      path="results"
                      element={
                        <SearchGate>
                          <ResultsPage />
                        </SearchGate>
                      }
                    />
                    <Route path="about" element={<Navigate to="/welcome" replace />} />
                    {preview && (
                      <Route path="preview" element={<preview.Frame />}>
                        <Route path="explore" element={<preview.Explore />} />
                        <Route path="library" element={<preview.Library />} />
                        <Route path="works/:id" element={<preview.Work />} />
                      </Route>
                    )}
                    <Route path="*" element={<NotFoundPage />} />
                  </Route>
                </Routes>
              </StartupHandoff>
            </Suspense>
          </PageBoundary>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
