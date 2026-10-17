import { Navigate, Link } from 'react-router-dom';
import { useAuth } from './context';
export default function AccountPage() {
  const { session, busy, logout, error, offline } = useAuth();
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
