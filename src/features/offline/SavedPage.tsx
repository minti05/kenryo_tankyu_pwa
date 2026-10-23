import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/context';
import { cacheTime, deleteSaved, listSaved, subscribeCache, LIMIT, type SavedPdf } from './store';
import { DOCUMENT_LABELS } from '../discovery/search';
export default function SavedPage() {
  const { cacheSession, offline } = useAuth(),
    [rows, setRows] = useState<SavedPdf[]>([]),
    [now, setNow] = useState(0),
    [error, setError] = useState(''),
    [from, setFrom] = useState(''),
    [to, setTo] = useState('');
  useEffect(() => {
    let alive = true;
    const refresh = () => {
      setNow(Date.now());
      if (cacheSession)
        void listSaved(cacheSession)
          .then((value) => {
            if (alive) {
              setRows(value);
              setNow(cacheTime());
              setError('');
            }
          })
          .catch(() => {
            if (alive) {
              setRows([]);
              setError(
                'この端末の保存を読み取れませんでした。オンラインの作品は引き続き閲覧できます。',
              );
            }
          });
    };
    refresh();
    const unsubscribe = subscribeCache(refresh),
      timer = setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      alive = false;
      unsubscribe();
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [cacheSession]);
  async function remove(id?: string, kind?: string, range?: { from: number; to: number }) {
    if (!cacheSession) return;
    try {
      await deleteSaved(cacheSession, id, kind, range);
      setRows(await listSaved(cacheSession));
    } catch {
      setError('保存を削除できませんでした。もう一度お試しください。');
    }
  }
  function removeRange() {
    const start = Date.parse(from + 'T00:00:00+09:00'),
      end = Date.parse(to + 'T00:00:00+09:00') + 86400000;
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      setError('削除する期間を確認してください。');
      return;
    }
    if (confirm('指定期間に保存したPDFを、この端末から削除しますか？'))
      void remove(undefined, undefined, { from: start, to: end });
  }
  return (
    <div className="page-container reading-page">
      <Link className="text-link" to="/account">
        ← アカウントに戻る
      </Link>
      <h1>端末に保存した資料</h1>
      <p>
        {offline
          ? 'オフラインです。以前ログインした同じアカウントの保存資料だけを開けます。'
          : '閲覧したPDFは、この端末に3日間保存されます。'}
      </p>
      <p>
        オフラインで開いても期限は延びません。ブラウザの空き容量や設定によって保存が失われる場合があります。閉じている間の期限切れは、次に開いたときに削除します。
      </p>
      <p role="status">
        {rows.length}件 · {(rows.reduce((n, r) => n + r.bytes, 0) / 1024 / 1024).toFixed(1)}MiB /{' '}
        {LIMIT / 1024 / 1024}MiB（PDF本体）
      </p>
      {error && <p role="alert">{error}</p>}
      {!cacheSession && <p>端末への保存を利用できません。通信に接続して作品をご覧ください。</p>}
      {rows.length === 0 ? (
        <p>期限内の保存資料はありません。オンラインで作品を開くと保存されます。</p>
      ) : (
        <ul className="saved-list">
          {rows.map((row) => (
            <li key={row.key}>
              <Link to={`/works/${row.id}?kind=${row.kind}&from=%2Fsaved`}>
                {row.work.title} · {DOCUMENT_LABELS[row.kind as keyof typeof DOCUMENT_LABELS]}
              </Link>
              <p>
                {(row.bytes / 1_000_000).toFixed(2)}MB · 期限{' '}
                {new Date(row.expiresAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })} ·
                残り約{Math.max(0, Math.ceil((row.expiresAt - now) / 3600000))}時間
              </p>
              <button className="button quiet" onClick={() => void remove(row.id, row.kind)}>
                この保存を削除
              </button>
            </li>
          ))}
        </ul>
      )}
      <section>
        <h2>この端末の保存を整理</h2>
        <p>クラウドの閲覧履歴や、手動でダウンロードしたファイルは削除されません。</p>
        <label>
          保存日の開始
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>{' '}
        <label>
          保存日の終了
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>{' '}
        <button className="button secondary" disabled={!from || !to} onClick={removeRange}>
          期間内の保存を削除
        </button>
        <button
          className="button secondary"
          disabled={!rows.length}
          onClick={() => {
            if (confirm('この端末の保存PDFをすべて削除しますか？')) void remove();
          }}
        >
          保存をすべて削除
        </button>
      </section>
      <p>
        アプリ内の保存はログアウト時に削除されます。手動で保存したPDFは、3日後も端末に残ります。
      </p>
    </div>
  );
}
