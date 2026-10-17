import { Component, lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from './Layout';
import { PREVIEW_ENABLED } from '../lib/environment';
import WelcomePage from '../pages/WelcomePage';
import { AuthProvider } from '../features/auth/AuthProvider';
const SavedPage = lazy(() => import('../features/offline/SavedPage'));
const SearchPage = lazy(() => import('../features/discovery/SearchPage'));
const SearchGate = lazy(() => import('../features/auth/RequireSession'));
const WorkPage = lazy(() => import('../features/works/WorkPage'));
const AccountPage = lazy(() => import('../features/auth/AccountPage'));
const AboutPage = lazy(() => import('../pages/AboutPage'));
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
      <div className="page-container empty-state">
        <h1>画面を読み込めませんでした。</h1>
        <p>もう一度お試しください。</p>
        <button className="button primary" onClick={() => window.location.reload()}>
          読み直す
        </button>
      </div>
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
              fallback={
                <div className="loading-state" role="status">
                  画面を読み込んでいます…
                </div>
              }
            >
              <Routes>
                <Route element={<Layout />}>
                  <Route index element={<Navigate to="/welcome" replace />} />
                  <Route path="welcome" element={<WelcomePage />} />
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
                  <Route
                    path="saved"
                    element={
                      <SearchGate>
                        <SavedPage />
                      </SearchGate>
                    }
                  />
                  <Route path="account" element={<AccountPage />} />
                  <Route path="about" element={<AboutPage />} />
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
            </Suspense>
          </PageBoundary>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
