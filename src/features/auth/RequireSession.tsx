import { StartupScreen } from '../../components/StartupScreen';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from './context';
export default function RequireSession({ children }: { children: React.ReactNode }) {
  const auth = useAuth(),
    location = useLocation();
  if (!auth.ready || auth.busy) return <StartupScreen />;
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
  if (auth.session.role === 'unassigned')
    return (
      <div className="page-container empty-state">
        <h1>登録待ち</h1>
        <p>
          {auth.session.registration === 'processing'
            ? '利用登録を反映しています。少し待ってから確認してください。'
            : '学校アカウントの利用登録を確認しています。登録が完了するまで作品は閲覧できません。'}
        </p>
        <button className="button primary" onClick={() => void auth.retry()}>
          登録状況を確認
        </button>
        <button className="button" onClick={() => void auth.logout()}>
          ログアウト
        </button>
      </div>
    );
  return (
    <>
      {auth.error && (
        <div className="page-container" role="status">
          <p>{auth.error}</p>
          <button className="button secondary" onClick={() => void auth.retry()}>
            接続を確認する
          </button>
        </div>
      )}
      {children}
    </>
  );
}
