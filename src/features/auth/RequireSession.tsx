import { Link, useLocation } from 'react-router-dom';
import { useAuth } from './context';
export default function RequireSession({ children }: { children: React.ReactNode }) {
  const auth = useAuth(),
    location = useLocation();
  if (!auth.ready || auth.busy)
    return (
      <div className="loading-state" role="status">
        ログイン状態を確認しています…
      </div>
    );
  if (!auth.session)
    return (
      <div className="page-container empty-state">
        <h1>学校のアカウントでログイン</h1>
        <p>{auth.error || '作品を見るには、学校のGoogleアカウントでログインしてください。'}</p>
        <Link
          to={`/welcome?next=${encodeURIComponent(location.pathname + location.search)}`}
          className="button primary"
        >
          ログイン画面へ
        </Link>
      </div>
    );
  return children;
}
