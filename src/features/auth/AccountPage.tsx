import { DisplaySettings } from './DisplaySettings';
import { useDisplayIdentity } from './display-context';
import { schoolGrade } from '../../contracts/access.generated';
import { Moon, LogOut, HardDrive, ChevronRight } from 'lucide-react';
import { PushSettings } from '../notifications/PushSettings';
import { useTheme } from '../../lib/theme';
import './settings.css';
import { useState } from 'react';
import { libraryMessage } from '../library/client';
import { Link, Navigate } from 'react-router-dom';
import { PolicyLinks } from '../../components/PolicyLinks';
import { AccountAvatar } from './AccountAvatar';
import { useAuth } from './context';
export default function AccountPage() {
  const { identity } = useDisplayIdentity();
  const grade = identity.enterYear ? schoolGrade(identity.enterYear) : null;
  const { theme, setTheme } = useTheme();
  const [confirmDelete, setConfirmDelete] = useState(false),
    [deleting, setDeleting] = useState(false),
    [deleteError, setDeleteError] = useState('');
  const { session, busy, logout, deleteAccount, error, offline, profile } = useAuth();
  if (busy)
    return (
      <div className="loading-state" role="status">
        利用資格を確認しています…
      </div>
    );
  if (!session) return <Navigate to="/welcome" replace />;
  return (
    <div className="page-container settings-page">
      <h1 className="sr-only">アカウント設定</h1>
      <div className="settings-profile">
        <AccountAvatar />
        <div>
          {profile?.displayName || '学校のGoogleアカウント'}
          <small>
            {identity.role === 'admin'
              ? '管理者'
              : identity.role === 'teacher'
                ? '教員'
                : `生徒${identity.enterYear ? ` · ${identity.enterYear}年度入学${grade ? `（${grade}年）` : ''}` : ' · 入学年度未登録'}`}
          </small>
          {offline && <small>オフラインで利用中</small>}
        </div>
      </div>
      <DisplaySettings />
      <section className="settings-group" aria-label="表示と通知">
        <div className="setting-row">
          <Moon size={21} />
          <div className="setting-copy">
            <span>テーマ</span>
            <small>{theme === 'dark' ? 'ダーク' : 'ライト'}</small>
          </div>
          <button
            className="setting-switch"
            role="switch"
            aria-label="ダークモード"
            aria-checked={theme === 'dark'}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            <span />
          </button>
        </div>
        <PushSettings compact />
        <Link className="setting-row saved-setting" to="/saved">
          <HardDrive size={21} />
          <span>端末に保存した資料</span>
          <ChevronRight size={18} />
        </Link>
      </section>
      <section className="settings-group settings-links" aria-label="サポート">
        <PolicyLinks settings />
      </section>
      <section className="settings-group" aria-label="アカウントの管理">
        <button className="setting-row setting-action" onClick={() => void logout()}>
          <LogOut size={21} />
          <span>ログアウト</span>
        </button>
      </section>
      <details className="settings-delete">
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
    </div>
  );
}
