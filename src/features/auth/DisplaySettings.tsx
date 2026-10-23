import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { schoolGrade } from '../../contracts/access.generated';
import { useAuth } from './context';
import { useDisplayIdentity } from './display-context';
export function DisplaySettings() {
  const { session, offline } = useAuth();
  const { identity, previewing, setPreview } = useDisplayIdentity();
  const [currentYear] = useState(() => {
    const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
    return now.getUTCFullYear() - (now.getUTCMonth() < 3 ? 1 : 0);
  });
  if (session?.role !== 'admin' || offline) return null;
  return (
    <section className="settings-group" aria-label="管理者の表示確認">
      <div className="setting-row">
        <ShieldCheck size={21} />
        <div className="setting-copy">
          <span>表示を確認</span>
          <small>実際のアカウント権限は変更されません</small>
        </div>
      </div>
      <label className="setting-row">
        <span className="setting-copy">表示する権限</span>
        <select
          aria-label="表示する権限"
          value={previewing ? identity.role : 'admin'}
          onChange={(e) =>
            setPreview(
              e.target.value === 'admin'
                ? null
                : e.target.value === 'teacher'
                  ? { role: 'teacher' }
                  : { role: 'student', enterYear: currentYear },
            )
          }
        >
          <option value="admin">管理者（通常表示）</option>
          <option value="teacher">教員</option>
          <option value="student">生徒</option>
        </select>
      </label>
      {identity.role === 'student' && (
        <label className="setting-row">
          <span className="setting-copy">入学年度</span>
          <select
            aria-label="表示する入学年度"
            value={identity.enterYear ?? ''}
            onChange={(e) =>
              setPreview({
                role: 'student',
                ...(e.target.value ? { enterYear: Number(e.target.value) } : {}),
              })
            }
          >
            <option value="">未登録</option>
            {Array.from({ length: currentYear - 2020 + 2 }, (_, i) => currentYear + 1 - i).map(
              (year) => (
                <option key={year} value={year}>
                  {year}年度入学{schoolGrade(year) ? `（${schoolGrade(year)}年）` : ''}
                </option>
              ),
            )}
          </select>
        </label>
      )}
    </section>
  );
}
export function DisplayPreviewBanner() {
  const { identity, previewing, setPreview } = useDisplayIdentity();
  if (!previewing) return null;
  return (
    <aside className="role-preview-banner" role="status">
      <span>
        {identity.role === 'teacher'
          ? '教員'
          : `生徒 · ${identity.enterYear ? `${identity.enterYear}年度入学` : '年度未登録'}`}
        として表示を確認中
      </span>
      <button onClick={() => setPreview(null)}>確認を終了</button>
    </aside>
  );
}
