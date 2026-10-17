import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
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
import { safePdfName } from '../works/pdf-data';
import { DOCUMENT_LABELS } from '../discovery/search';
const Viewer = lazy(() => import('../works/PdfViewer'));
export default function OfflineWorkPage() {
  const { id = '' } = useParams(),
    [params, setParams] = useSearchParams(),
    { cacheSession } = useAuth(),
    [rows, setRows] = useState<SavedPdf[]>([]),
    [data, setData] = useState<(CachedPdf & { url: string }) | null>(null),
    [checking, setChecking] = useState(true),
    [error, setError] = useState(''),
    [prepared, setPrepared] = useState(0);
  const kind = params.get('kind') ?? rows[0]?.kind;
  useEffect(() => {
    let closed = false,
      requestId = 0;
    let url: string | undefined;
    const read = async () => {
      const ticket = ++requestId;
      setChecking(true);
      setData(null);
      setPrepared(0);
      if (url) URL.revokeObjectURL(url);
      try {
        if (!cacheSession) throw new Error('identity');
        const list = (await listSaved(cacheSession)).filter((r) => r.id === id);
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
        setPrepared(0);
        setError(
          '保存期限が切れたか、端末時刻の確認が必要です。通信に接続して作品を開き直してください。',
        );
        void listSaved(cacheSession).catch(() => {});
      } else timer = setTimeout(check, Math.min(1000, Math.max(1, data.expiresAt - cacheTime())));
    };
    timer = setTimeout(check, Math.min(1000, Math.max(1, data.expiresAt - cacheTime())));
    return () => clearTimeout(timer);
  }, [data, cacheSession]);
  async function prepare() {
    if (!cacheSession || !data) return;
    try {
      const fresh = await readSaved(cacheSession, id, data.kind, data.revision);
      if (fresh && usable(cacheSession, fresh)) setPrepared(performance.now());
      else {
        URL.revokeObjectURL(data.url);
        setData(null);
        setError('保存期限が切れました。通信に接続して確認してください。');
      }
    } catch {
      setPrepared(0);
      setError('保存資料を確認できませんでした。');
    }
  }
  return (
    <div className="page-container">
      <Link to="/saved">← 端末の保存へ</Link>
      <p role="status">
        オフライン · 保存済みの版を表示します。最新の公開状態は通信に接続したときに確認します。
      </p>
      <h1>{data?.work.title ?? '保存した資料'}</h1>
      <div role="group" aria-label="保存済み資料の種類">
        {rows.map((r) => (
          <button
            className="button secondary"
            key={r.key}
            aria-pressed={r.kind === kind}
            onClick={() => setParams({ kind: r.kind })}
          >
            {DOCUMENT_LABELS[r.kind as keyof typeof DOCUMENT_LABELS]}
          </button>
        ))}
      </div>
      {checking ? (
        <p role="status">期限と保存資料を確認しています…</p>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : (
        data &&
        cacheSession && (
          <>
            <p>
              {data.work.author} · 期限{' '}
              {new Date(data.expiresAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
            </p>
            {data.work.summary && <p>{data.work.summary}</p>}
            <Suspense fallback={<p>PDF表示を準備しています…</p>}>
              <Viewer blob={data.blob} onReady={() => {}} />
            </Suspense>
            <section>
              <h2>資料を手元に</h2>
              <p>
                手動で保存したPDFは3日後も自動削除されません。学校の利用規約を守ってご利用ください。
              </p>
              <button className="button primary" onClick={() => void prepare()}>
                ダウンロード
              </button>
              {prepared > 0 && (
                <a
                  className="button secondary"
                  href={data.url}
                  download={safePdfName(id, data.kind, data.work.title)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    if (performance.now() - prepared > 5000 || !usable(cacheSession, data)) {
                      e.preventDefault();
                      setPrepared(0);
                      void prepare();
                    }
                  }}
                >
                  PDFを端末に保存
                </a>
              )}
            </section>
          </>
        )
      )}
    </div>
  );
}
