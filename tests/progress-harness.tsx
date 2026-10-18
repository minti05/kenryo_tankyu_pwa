// Local development/test entry. Not imported by src, never part of a production build.
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, useParams, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext, type AuthState } from '../src/features/auth/context';
import LibraryPage from '../src/features/library/LibraryPage';
import { WorkActions } from '../src/features/library/WorkActions';
import { SAMPLE_WORKS } from '../src/features/discovery/sample-works';
import { CategoryArt } from '../src/components/CategoryArt';
import '../src/styles/global.css';
const favorites = new Set([SAMPLE_WORKS[0]!.documentID]);
let history = SAMPLE_WORKS.slice(0, 4);
const versions = new Map<string, number>();
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  await new Promise((r) => setTimeout(r, 180));
  const url = new URL(path, location.origin);
  const data = typeof options.body === 'string' ? JSON.parse(options.body) : {};
  if (url.pathname === '/api/stats')
    return {
      version: '1',
      today: 2,
      week: history.length,
      total: history.length,
      serverTime: new Date().toISOString(),
    } as T;
  if (url.pathname === '/api/history' && options.method === 'DELETE') {
    history = [];
    return { version: '1', deleted: true } as T;
  }
  if (url.pathname.startsWith('/api/history/') && options.method === 'DELETE') {
    const id = path.split('/').at(-1)!;
    history = history.filter((w) => w.documentID !== id);
    favorites.delete(id);
    return { version: '1', deleted: true } as T;
  }
  if (path === '/api/history' || path === '/api/favorites')
    return {
      version: '1',
      items: (path.endsWith('favorites')
        ? SAMPLE_WORKS.filter((w) => favorites.has(w.documentID))
        : history
      ).map((work) => ({
        work,
        viewedAt: new Date().toISOString(),
        favorite: favorites.has(work.documentID),
      })),
      nextCursor: null,
    } as T;
  if (path === '/api/reports')
    return { version: '1', id: data.operationId, status: 'received' } as T;
  const id = path.split('/')[3]!;
  if (options.method === 'PUT') {
    if (data.favorite) favorites.add(id);
    else favorites.delete(id);
    versions.set(id, (versions.get(id) ?? 0) + 1);
  }
  return {
    version: '1',
    favorite: favorites.has(id),
    revision: versions.get(id) ?? 0,
    count: favorites.has(id) ? 1 : 0,
  } as T;
}
const auth: AuthState = {
  session: { version: '1', uid: 'local-progress', role: 'student' },
  offline: false,
  cacheSession: null,
  request,
  requestResponse: async () => new Response(),
  ready: true,
  configured: true,
  busy: false,
  error: '',
  signedIn: true,
  login: () => {},
  logout: async () => {},
  deleteAccount: async () => {},
  retry: async () => {},
};
function Work() {
  const { id } = useParams();
  const work = SAMPLE_WORKS.find((w) => w.documentID === id);
  return (
    <div className="page-container reading-page">
      <Link to="/library">← ライブラリへ</Link>
      {work && (
        <>
          <CategoryArt category={work.category1} />
          <h1>{work.title}</h1>
          <p>{work.author}</p>
          <WorkActions work={work} />
          <p>この確認画面はお気に入り・報告操作のサンプルです。実作品や本番APIには接続しません。</p>
        </>
      )}
    </div>
  );
}
createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <AuthContext.Provider value={auth}>
      <BrowserRouter>
        <div className="preview-banner">
          <b>T11 作業プレビュー · 架空データ</b>{' '}
          履歴・お気に入り・報告の操作を試せます。再読み込みで戻ります。
        </div>
        <Routes>
          <Route path="/works/:id" element={<Work />} />
          <Route path="*" element={<LibraryPage />} />
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  </QueryClientProvider>,
);
