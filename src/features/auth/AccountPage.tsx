import { Navigate } from 'react-router-dom';
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
      <p>作品の検索と閲覧は、次の工程で接続します。</p>
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
