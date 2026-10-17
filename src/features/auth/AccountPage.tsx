import { Navigate, Link } from 'react-router-dom';
import { useAuth } from './context';
export default function AccountPage() {
  const { session, busy, logout, error } = useAuth();
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
      <h1>ログインできました。</h1>
      <p>学校アカウントと利用資格を確認しました。</p>
      <p>先輩の問いを、キーワードやテーマから探してみましょう。</p>
      <Link className="button primary" to="/explore">
        作品を探す
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
