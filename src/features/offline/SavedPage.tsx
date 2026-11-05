import { useEffect, useState } from 'react';
import { ArrowLeft, Check, HardDrive, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Modal } from '../../components/Modal';
import { LoadingIndicator } from '../../components/Loading';
import { HistoryManagement } from '../library/HistoryManagement';
import { useAuth } from '../auth/context';
import { deleteSaved, listSaved, subscribeCache } from './store';
import styles from '../library/HistoryManagement.module.css';

export default function SavedPage() {
  const { cacheSession } = useAuth();
  const [cache, setCache] = useState<{ count: number; bytes: number } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!cacheSession) return;
    let alive = true;
    const refresh = () => {
      void listSaved(cacheSession)
        .then((rows) => {
          if (alive) {
            setCache({ count: rows.length, bytes: rows.reduce((sum, row) => sum + row.bytes, 0) });
            setError('');
          }
        })
        .catch(() => {
          if (alive) {
            setCache(null);
            setError('キャッシュを確認できません。');
          }
        });
    };
    refresh();
    const unsubscribe = subscribeCache(refresh);
    const timer = setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    return () => {
      alive = false;
      unsubscribe();
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [cacheSession]);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 2000);
    return () => clearTimeout(timer);
  }, [message]);
  async function remove() {
    if (!cacheSession || removing) return;
    setRemoving(true);
    setError('');
    setMessage('');
    try {
      await deleteSaved(cacheSession);
      const rows = await listSaved(cacheSession);
      setCache({ count: rows.length, bytes: rows.reduce((sum, row) => sum + row.bytes, 0) });
      setConfirming(false);
      setMessage('削除しました');
    } catch {
      setError('削除できませんでした。もう一度お試しください。');
    } finally {
      setRemoving(false);
    }
  }
  return (
    <div className={`page-container ${styles.page}`}>
      <Link className={styles.back} to="/account">
        <ArrowLeft size={18} />
        アカウント
      </Link>
      <h1>履歴の管理</h1>
      <div className={styles.grid}>
        <section className={styles.card} aria-label="PDFキャッシュの管理">
          <div className={styles.heading}>
            <span className={styles.icon}>
              <HardDrive size={24} strokeWidth={1.6} />
            </span>
            <h2>PDFキャッシュ</h2>
            <span className={styles.badge}>2週間</span>
          </div>
          <p className={styles.metrics} aria-label="PDFキャッシュの件数と容量">
            <span>
              <strong>{cache?.count ?? '—'}</strong> 件
            </span>
            <span>·</span>
            <span>
              <strong>{cache ? (cache.bytes / 1_000_000).toFixed(1) : '—'}</strong> MB
            </span>
          </p>
          <button
            className={styles.clear}
            aria-label="PDFキャッシュをまとめて削除"
            disabled={removing || !cacheSession || !cache?.count}
            onClick={() => {
              setError('');
              setConfirming(true);
            }}
          >
            {removing || (cacheSession && cache === null) ? (
              <LoadingIndicator inline label={removing ? '削除中' : 'キャッシュを確認中'} />
            ) : message ? (
              <>
                <Check size={17} />
                削除しました
              </>
            ) : (
              <>
                <Trash2 size={17} />
                まとめて削除
              </>
            )}
          </button>
          {message && (
            <p className="sr-only" role="status">
              {message}
            </p>
          )}
          {error && !confirming && (
            <p className={styles.feedback} role="alert">
              {error}
            </p>
          )}
        </section>
        <HistoryManagement />
      </div>
      {confirming && (
        <Modal
          variant="confirm"
          title="PDFキャッシュを削除しますか？"
          onClose={() => {
            if (!removing) setConfirming(false);
          }}
        >
          <p>
            {cache?.count ?? 0}件 · {((cache?.bytes ?? 0) / 1_000_000).toFixed(1)} MB
          </p>
          {error && <p role="alert">{error}</p>}
          <div className="confirm-modal-actions">
            <button disabled={removing} onClick={() => setConfirming(false)}>
              キャンセル
            </button>
            <button disabled={removing} onClick={() => void remove()}>
              {removing ? <LoadingIndicator inline label="削除中" /> : '削除する'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
