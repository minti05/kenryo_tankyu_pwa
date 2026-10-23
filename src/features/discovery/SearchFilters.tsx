import { useEffect, useRef, useState } from 'react';
import { SlidersHorizontal, X, RotateCcw, ArrowRight } from 'lucide-react';
import { CATEGORY_CATALOG } from '../../contracts/catalog.generated';
import './results.css';

import { COURSES, EVENTS, KINDS, AWARDS, conditionLabels } from './filter-options';
export function SearchFilters({
  params,
  awards,
  onApply,
}: {
  params: URLSearchParams;
  awards: boolean;
  onApply: (params: URLSearchParams) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => new URLSearchParams(params));
  const category = CATEGORY_CATALOG.find((c) => c.id === draft.get('category'));
  useEffect(() => {
    if (!open) return;
    const element = dialog.current!;
    const opener = trigger.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element.showModal();
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      opener?.focus({ preventScroll: true });
    };
  }, [open]);
  function change(key: string, value: string) {
    setDraft((previous) => {
      const next = new URLSearchParams(previous);
      if (value) next.set(key, value);
      else next.delete(key);
      if (key === 'category') next.delete('subcategory');
      next.delete('cursor');
      return next;
    });
  }
  function select(
    key: string,
    label: string,
    all: string,
    options: readonly (readonly string[])[],
    disabled = false,
  ) {
    return (
      <label className="filter-field">
        <span>{label}</span>
        <select
          aria-label={label}
          value={draft.get(key) || ''}
          onChange={(e) => change(key, e.target.value)}
          disabled={disabled}
        >
          <option value="">{all}</option>
          {options.map(([id, text]) => (
            <option key={id} value={id}>
              {text}
            </option>
          ))}
        </select>
      </label>
    );
  }
  const count = conditionLabels(params).filter((c) => c.key !== 'q').length;
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="filter-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setDraft(new URLSearchParams(params));
          setOpen(true);
        }}
      >
        <SlidersHorizontal size={18} />
        <span>フィルター</span>
        {count > 0 && <span className="filter-count">{count}</span>}
      </button>
      <dialog
        ref={dialog}
        className="filter-dialog"
        aria-labelledby="filter-title"
        onCancel={(e) => {
          e.preventDefault();
          setOpen(false);
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            const rect = e.currentTarget.getBoundingClientRect();
            if (
              e.clientX < rect.left ||
              e.clientX > rect.right ||
              e.clientY < rect.top ||
              e.clientY > rect.bottom
            )
              setOpen(false);
          }
        }}
      >
        <form
          className="filter-panel"
          onSubmit={(e) => {
            e.preventDefault();
            const next = new URLSearchParams(draft);
            next.delete('cursor');
            for (const key of ['q', 'awardName']) {
              const value = next.get(key)?.trim();
              if (value) next.set(key, value);
              else next.delete(key);
            }
            onApply(next);
            setOpen(false);
          }}
        >
          <div className="filter-heading">
            <h2 id="filter-title">フィルター</h2>
            <button
              type="button"
              className="icon-button"
              aria-label="フィルターを閉じる"
              onClick={() => setOpen(false)}
            >
              <X size={22} />
            </button>
          </div>
          <div className="filter-fields">
            <label className="filter-field filter-wide">
              <span>キーワード</span>
              <input
                type="search"
                aria-label="キーワード"
                placeholder="キーワードを入力"
                maxLength={100}
                value={draft.get('q') || ''}
                onChange={(e) => change('q', e.target.value)}
              />
            </label>
            {select(
              'category',
              'カテゴリ',
              'すべてのカテゴリ',
              CATEGORY_CATALOG.map((c) => [c.id, c.label]),
            )}
            {select(
              'subcategory',
              'サブカテゴリ',
              'すべてのサブカテゴリ',
              category?.subcategories.map((c) => [c.id, c.label]) || [],
              !category,
            )}
            {select(
              'year',
              '入学年度',
              'すべての年度',
              Array.from({ length: Math.max(1, new Date().getFullYear() - 2019) }, (_, i) =>
                String(new Date().getFullYear() - i),
              ).map((y) => [y, `${y}年度入学`]),
            )}
            {select('course', '学科', 'すべての学科', COURSES)}
            {select('event', '活動', 'すべての活動', EVENTS)}
            {select('kind', '資料の種類', 'すべての資料', KINDS)}
            {awards && (
              <>
                {select('award', '賞', 'すべての賞', AWARDS)}
                <label className="filter-field">
                  <span>賞名</span>
                  <input
                    aria-label="賞名"
                    maxLength={100}
                    value={draft.get('awardName') || ''}
                    onChange={(e) => change('awardName', e.target.value)}
                  />
                </label>
              </>
            )}
          </div>
          <div className="filter-footer">
            <button
              type="button"
              className="filter-reset"
              onClick={() =>
                setDraft(
                  new URLSearchParams(params.has('sort') ? { sort: params.get('sort')! } : {}),
                )
              }
            >
              <RotateCcw size={16} />
              条件をクリア
            </button>
            <button type="submit" className="button primary">
              この条件で検索
              <ArrowRight size={18} />
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
