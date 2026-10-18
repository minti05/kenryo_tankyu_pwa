import { useRef, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { FavoriteDto, ReceiptDto } from '../../contracts/library.generated';
import type { SearchWorkDto } from '../../contracts/discovery.generated';
import { CATEGORY_CATALOG } from '../../contracts/catalog.generated';
import { useAuth } from '../auth/context';
import { ApiError } from '../../lib/api-client';
import { libraryMessage, retryableIntent } from './client';
import styles from './LibraryPage.module.css';
export function WorkActions({ work }: { work: SearchWorkDto }) {
  const { session, request, offline } = useAuth(),
    query = useQueryClient(),
    intent = useRef(retryableIntent());
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [kind, setKind] = useState('other'),
    [category, setCategory] = useState<string>(work.category1),
    [receipt, setReceipt] = useState('');
  const state = useQuery({
    queryKey: ['favorite', session?.uid, work.documentID],
    enabled: !offline,
    queryFn: () => request<FavoriteDto>(`/api/works/${work.documentID}/state`),
    staleTime: 0,
  });
  async function favorite() {
    if (!state.data || busy) return;
    setBusy(true);
    setMessage('');
    const body = { favorite: !state.data.favorite, expectedRevision: state.data.revision };
    try {
      await request(`/api/favorites/${work.documentID}`, {
        method: 'PUT',
        body: JSON.stringify({ ...body, ...intent.current({ id: work.documentID, ...body }) }),
      });
      await Promise.all([state.refetch(), query.invalidateQueries({ queryKey: ['library'] })]);
      intent.current.clear();
      setMessage(body.favorite ? 'お気に入りに追加しました。' : 'お気に入りから外しました。');
    } catch (error) {
      if (error instanceof ApiError && error.code === 'favorite_conflict') await state.refetch();
      setMessage(libraryMessage(error));
    } finally {
      setBusy(false);
    }
  }
  async function report(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const f = new FormData(e.currentTarget);
    let details: Record<string, unknown>;
    if (kind === 'info')
      details = {
        title: String(f.get('title')),
        author: String(f.get('author')),
        course: String(f.get('course')),
        enterYear: Number(f.get('year')),
      };
    else if (kind === 'category')
      details = {
        slot: Number(f.get('slot')),
        category,
        subcategory: String(f.get('subcategory')),
      };
    else if (kind === 'pdf')
      details = { kinds: f.getAll('kinds'), description: String(f.get('description')) };
    else details = { description: String(f.get('description')) };
    const body = { documentID: work.documentID, kind, details };
    setBusy(true);
    setMessage('');
    try {
      const result = await request<ReceiptDto>('/api/reports', {
        method: 'POST',
        body: JSON.stringify({ ...body, ...intent.current(body) }),
      });
      intent.current.clear();
      setReceipt(result.id);
      setMessage('報告を受け付けました。内容は運営者が確認します。');
    } catch (error) {
      setMessage(libraryMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={styles.panel} aria-label="お気に入りと報告">
      <button
        className="button primary"
        disabled={busy || offline || !state.data}
        aria-pressed={state.data?.favorite ?? false}
        onClick={() => void favorite()}
      >
        {state.data?.favorite ? 'お気に入りに追加済み' : 'お気に入りに追加'}
      </button>
      {state.data && <p>{state.data.count}人がお気に入りに保存しています</p>}
      {state.isError && (
        <button className="button secondary" onClick={() => void state.refetch()}>
          お気に入りを読み直す
        </button>
      )}
      <details>
        <summary>作品情報やPDFについて報告する</summary>
        <p>
          学校向けアーカイブの改善に使います。個人情報や秘密情報は入力しないでください。作品情報は送信だけでは変更されません。
        </p>
        <form onSubmit={(e) => void report(e)}>
          <label>
            報告の種類
            <select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
                setReceipt('');
              }}
            >
              <option value="info">作品情報の修正</option>
              <option value="category">カテゴリの提案</option>
              <option value="pdf">PDFを閲覧できない</option>
              <option value="other">その他</option>
            </select>
          </label>
          {kind === 'info' && (
            <>
              <label>
                タイトル
                <input name="title" defaultValue={work.title} required maxLength={300} />
              </label>
              <label>
                作者
                <input name="author" defaultValue={work.author} required maxLength={300} />
              </label>
              <label>
                学科
                <select name="course" defaultValue={work.course}>
                  <option value="tankyu">探究科</option>
                  <option value="general">普通科</option>
                </select>
              </label>
              <label>
                入学年度
                <input
                  name="year"
                  type="number"
                  min={2000}
                  max={2100}
                  defaultValue={work.enterYear}
                  required
                />
              </label>
            </>
          )}
          {kind === 'category' && (
            <>
              <label>
                変更する分類
                <select name="slot">
                  <option value="1">カテゴリ1</option>
                  <option value="2">カテゴリ2</option>
                </select>
              </label>
              <label>
                カテゴリ
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  {CATEGORY_CATALOG.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                サブカテゴリ
                <select key={category} name="subcategory">
                  {CATEGORY_CATALOG.find((c) => c.id === category)?.subcategories.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          {kind === 'pdf' && (
            <fieldset>
              <legend>開けない資料（1つ以上）</legend>
              {(['poster', 'slide', 'report', 'thesis'] as const).map((k, i) => (
                <label key={k}>
                  <input type="checkbox" name="kinds" value={k} />
                  {['ポスター', 'スライド', 'レポート', '論文'][i]}
                </label>
              ))}
            </fieldset>
          )}
          {(kind === 'pdf' || kind === 'other') && (
            <label>
              内容
              <textarea name="description" required maxLength={2000} />
            </label>
          )}
          <button className="button secondary" disabled={busy || offline} type="submit">
            報告を送信
          </button>
          {receipt && <p>受付番号：{receipt}</p>}
        </form>
      </details>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
