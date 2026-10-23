import { lazy, Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/context';
import {
  cacheTime,
  listSaved,
  readSaved,
  subscribeCache,
  usable,
  type SavedPdf,
  type CachedPdf,
} from './store';
import { orderDocuments } from '../discovery/search';
import { WorkReader } from '../works/WorkReader';
const Viewer = lazy(() => import('../works/PdfViewer'));
export default function OfflineWorkPage() {
  const { id = '' } = useParams(),
    [params, setParams] = useSearchParams(),
    { cacheSession } = useAuth(),
    [rows, setRows] = useState<SavedPdf[]>([]),
    [data, setData] = useState<(CachedPdf & { url: string }) | null>(null),
    [checking, setChecking] = useState(true),
    [error, setError] = useState('');
  const kind = params.get('kind') ?? rows[0]?.kind;
  useEffect(() => {
    let closed = false,
      requestId = 0;
    let url: string | undefined;
    const read = async () => {
      const ticket = ++requestId;
      setChecking(true);
      setData(null);
      if (url) URL.revokeObjectURL(url);
      try {
        if (!cacheSession) throw new Error('identity');
        const list = orderDocuments((await listSaved(cacheSession)).filter((r) => r.id === id));
        const pdf = await readSaved(cacheSession, id, kind ?? list[0]?.kind ?? 'poster');
        if (closed || ticket !== requestId) return;
        setRows(list);
        if (pdf && usable(cacheSession, pdf)) {
          url = URL.createObjectURL(pdf.blob);
          setData({ ...pdf, url });
          setError('');
        } else
          setError(
            'この資料は未保存、期限切れ、または現在の端末時刻では利用できません。通信に接続して作品を開き直してください。',
          );
      } catch {
        if (!closed && ticket === requestId)
          setError(
            '保存資料を確認できませんでした。通信に接続して、もう一度ログインしてください。',
          );
      } finally {
        if (!closed && ticket === requestId) setChecking(false);
      }
    };
    void read();
    const refresh = () => {
      void read();
    };
    const unsubscribe = subscribeCache(refresh);
    const visible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('focus', refresh);
    return () => {
      closed = true;
      unsubscribe();
      document.removeEventListener('visibilitychange', visible);
      window.removeEventListener('focus', refresh);
      if (url) URL.revokeObjectURL(url);
    };
  }, [cacheSession, id, kind]);
  useEffect(() => {
    if (!data || !cacheSession) return;
    let timer: ReturnType<typeof setTimeout>;
    const check = () => {
      if (!usable(cacheSession, data)) {
        URL.revokeObjectURL(data.url);
        setData(null);
        setError(
          '保存期限が切れたか、端末時刻の確認が必要です。通信に接続して作品を開き直してください。',
        );
        void listSaved(cacheSession).catch(() => {});
      } else timer = setTimeout(check, Math.min(1000, Math.max(1, data.expiresAt - cacheTime())));
    };
    timer = setTimeout(check, Math.min(1000, Math.max(1, data.expiresAt - cacheTime())));
    return () => clearTimeout(timer);
  }, [data, cacheSession]);
  if (!checking && (!data || !cacheSession))
    return (
      <div className="page-container">
        <h1>保存した資料</h1>
        {checking ? (
          <p role="status">期限と保存資料を確認しています…</p>
        ) : (
          <p role="alert">{error}</p>
        )}
      </div>
    );
  return (
    <WorkReader
      work={data?.work}
      kind={data?.kind}
      documents={(data ? rows : []).map((row) => ({
        kind: row.kind as 'poster' | 'report' | 'thesis' | 'slide',
        state: 'available',
        bytes: row.bytes,
        revision: row.revision,
        sha256: row.sha256,
      }))}
      onKind={(nextKind) => {
        const next = new URLSearchParams(params);
        next.set('kind', nextKind);
        setParams(next, { replace: true });
      }}
    >
      <Suspense fallback={<p role="status">PDF表示を準備しています…</p>}>
        {data && cacheSession ? (
          <Viewer blob={data.blob} onReady={() => {}} />
        ) : (
          <p role="status">期限と保存資料を確認しています…</p>
        )}
      </Suspense>
    </WorkReader>
  );
}
