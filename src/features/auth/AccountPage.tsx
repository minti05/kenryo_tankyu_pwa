import { useState } from 'react';
import { libraryMessage } from '../library/client';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from './context';
export default function AccountPage() {
  const [confirmDelete, setConfirmDelete] = useState(false),
    [deleting, setDeleting] = useState(false),
    [deleteError, setDeleteError] = useState('');
  const { session, busy, logout, deleteAccount, error, offline } = useAuth();
  if (busy)
    return (
      <div className="loading-state" role="status">
        利用資格を確認しています…
      </div>
    );
  if (!session) return <Navigate to="/welcome" replace />;
  return (
    <div className="page-container reading-page">
      <span className="eyebrow">YOUR ACCOUNT</span>
      <h1>{offline ? 'オフラインで利用中' : 'ログインできました。'}</h1>
      <p>
        {offline
          ? '前回確認した同じアカウントの、期限内の保存資料を利用できます。最新の資格は通信に接続したときに確認します。'
          : '学校アカウントと利用資格を確認しました。'}
      </p>
      <p>先輩の問いを、キーワードやテーマから探してみましょう。</p>
      <Link className="button primary" to="/explore">
        作品を探す
      </Link>
      <Link className="button secondary" to="/saved">
        端末の保存を開く
      </Link>
      <Link className="button secondary" to="/library">
        ライブラリを開く
      </Link>
      <details>
        <summary>アカウントを削除する</summary>
        <p>
          閲覧・検索履歴、お気に入り、報告、学校アカウントのアプリ利用登録を削除します。学校のGoogleアカウントや作品そのものは削除しません。端末内の保存も利用できなくなります。
        </p>
        <p>Googleで本人確認した後に受付します。削除完了まで時間がかかる場合があります。</p>
        <label>
          <input
            type="checkbox"
            checked={confirmDelete}
            onChange={(e) => setConfirmDelete(e.target.checked)}
          />{' '}
          削除内容を確認しました
        </label>
        <button
          className="button secondary"
          disabled={!confirmDelete || deleting || offline}
          onClick={() => {
            setDeleting(true);
            setDeleteError('');
            void deleteAccount()
              .catch((e) => setDeleteError(libraryMessage(e)))
              .finally(() => setDeleting(false));
          }}
        >
          Googleで本人確認して退会する
        </button>
        {deleteError && <p role="alert">{deleteError}</p>}
      </details>
      {error && <p role="alert">{error}</p>}
      <button
        className="button secondary"
        onClick={() => {
          void logout();
        }}
      >
        ログアウト
      </button>
    </div>
  );
}
