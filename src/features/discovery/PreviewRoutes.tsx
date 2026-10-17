import { useState } from 'react';
import { Link, Outlet, useLocation, useSearchParams, useParams } from 'react-router-dom';
import {
  Search,
  SlidersHorizontal,
  ArrowRight,
  ArrowLeft,
  Bookmark,
  BookOpen,
  RotateCcw,
} from 'lucide-react';
import { SAMPLE_WORKS } from './sample-works';
import { CATEGORY_CATALOG } from '../../contracts/catalog.generated';
import { CategoryArt } from '../../components/CategoryArt';
import { filterWorks, categoryLabel, documentTypes, DOCUMENT_LABELS } from './search';
import { WorkCard } from './WorkCard';
import { PreviewLibraryProvider, usePreviewLibrary } from '../library/PreviewLibrary';
import styles from './PreviewRoutes.module.css';
export function PreviewFrame() {
  return (
    <PreviewLibraryProvider>
      <Outlet />
    </PreviewLibraryProvider>
  );
}
export function ExplorePage() {
  const [themesExpanded, setThemesExpanded] = useState(false);
  const [params, setParams] = useSearchParams(),
    location = useLocation(),
    works = filterWorks(SAMPLE_WORKS, params),
    selected = params.get('category'),
    q = params.get('q') ?? '',
    hasFilters = ['q', 'category', 'year', 'kind'].some((k) => params.has(k));
  function update(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  }
  return (
    <div className="page-container">
      <section className={styles.intro}>
        <div>
          <span className="eyebrow">DISCOVER A NEW PERSPECTIVE</span>
          <h1>
            好奇心の、<span>その先へ。</span>
          </h1>
          <p>
            ひとつの問いから、新しい世界が広がる。
            <br className={styles.mobileOnly} />
            気になる探究を見つけよう。
          </p>
        </div>
        <div className={styles.indexMark} aria-hidden="true">
          <span>KENRYO</span>
          <strong>
            問いを、
            <br />
            ひらく。
          </strong>
        </div>
      </section>
      <form
        className={styles.search}
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          update('q', String(data.get('q') ?? '').trim());
        }}
      >
        <Search size={22} />
        <label className="sr-only" htmlFor="work-query">
          作品をキーワードで検索
        </label>
        <input
          id="work-query"
          key={q}
          name="q"
          defaultValue={q}
          placeholder="気になることを、ことばにしてみる"
          type="search"
          autoComplete="off"
        />
        <button className="button primary" type="submit">
          探す
          <ArrowRight size={16} />
        </button>
      </form>
      <section className={styles.themes} aria-labelledby="themes-title">
        <div className={styles.sectionHeading}>
          <h2 id="themes-title">テーマから出会う</h2>
          <button
            className={styles.expandThemes}
            aria-expanded={themesExpanded}
            aria-controls="theme-list"
            onClick={() => setThemesExpanded(!themesExpanded)}
          >
            {themesExpanded ? '閉じる' : 'すべてのテーマ'}
          </button>
        </div>
        <div
          id="theme-list"
          className={`${styles.categories} ${themesExpanded ? styles.categoriesExpanded : ''}`}
          role="group"
          aria-label="テーマで絞り込む"
        >
          <button
            className={!selected ? styles.activeCategory : ''}
            aria-pressed={!selected}
            onClick={() => update('category', '')}
          >
            <span className={styles.allThemes}>ALL</span>
            <span>すべて</span>
          </button>
          {CATEGORY_CATALOG.map((c) => (
            <button
              key={c.id}
              className={selected === c.id ? styles.activeCategory : ''}
              aria-pressed={selected === c.id}
              onClick={() => update('category', c.id)}
            >
              <CategoryArt category={c.id} />
              <span>{c.label}</span>
            </button>
          ))}
        </div>
      </section>
      <section className={styles.results} aria-labelledby="results-title">
        <div className={styles.resultsHeader}>
          <div>
            <span className="eyebrow">EXPLORE THE ARCHIVE</span>
            <h2 id="results-title">
              {q
                ? `「${q}」の検索結果`
                : selected
                  ? categoryLabel(selected)
                  : 'まだ知らない問いに、出会う。'}
            </h2>
          </div>
          <span className={styles.count} role="status">
            {works.length}
            <small>作品</small>
          </span>
        </div>
        <div className={styles.filters}>
          <span>
            <SlidersHorizontal size={15} />
            絞り込み
          </span>
          <label>
            <span className="sr-only">入学年度</span>
            <select
              aria-label="入学年度"
              value={params.get('year') ?? ''}
              onChange={(e) => update('year', e.target.value)}
            >
              <option value="">すべての年度</option>
              <option value="2024">2024年度入学</option>
              <option value="2023">2023年度入学</option>
              <option value="2022">2022年度入学</option>
            </select>
          </label>
          <label>
            <span className="sr-only">資料の種類</span>
            <select
              aria-label="資料の種類"
              value={params.get('kind') ?? ''}
              onChange={(e) => update('kind', e.target.value)}
            >
              <option value="">すべての資料</option>
              <option value="poster">ポスター</option>
              <option value="report">レポート</option>
              <option value="thesis">論文</option>
              <option value="slide">スライド</option>
            </select>
          </label>
          <label className={styles.sort}>
            <span className="sr-only">並び順</span>
            <select
              aria-label="並び順"
              value={params.get('sort') ?? 'newest'}
              onChange={(e) => update('sort', e.target.value)}
            >
              <option value="newest">新しい年度から</option>
              <option value="popular">サンプルの人気順</option>
            </select>
          </label>
          {hasFilters && (
            <button className={styles.clear} onClick={() => setParams({})}>
              <RotateCcw size={14} />
              条件をクリア
            </button>
          )}
        </div>
        {works.length ? (
          <div className={styles.workGrid}>
            {works.map((w) => (
              <WorkCard key={w.documentID} work={w} from={location.pathname + location.search} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <Search size={34} />
            <h3>別の問いから、探してみよう。</h3>
            <p>キーワードを短くしたり、絞り込み条件を減らしてみてください。</p>
            <button className="button secondary" onClick={() => setParams({})}>
              すべての作品を見る
            </button>
          </div>
        )}
      </section>
      <section className={styles.bottomNote}>
        <BookOpen size={22} />
        <div>
          <h2>気になる作品は、ライブラリへ。</h2>
          <p>
            保存ボタンで、サンプル作品をまとめて試せます。保存はこの画面プレビュー内だけに反映されます。
          </p>
        </div>
        <Link className="text-link" to="/preview/library">
          ライブラリを見る
          <ArrowRight size={17} />
        </Link>
      </section>
    </div>
  );
}
export function LibraryPage() {
  const { saved } = usePreviewLibrary(),
    works = SAMPLE_WORKS.filter((w) => saved.has(w.documentID));
  return (
    <div className="page-container">
      <section className={styles.libraryIntro}>
        <span className="eyebrow">YOUR COLLECTION</span>
        <h1>ライブラリ</h1>
        <p>気になる問いを、手元に集めよう。</p>
      </section>
      <p className={styles.libraryNote}>
        保存はこの画面プレビュー内だけに反映され、再読み込みでリセットされます。
      </p>
      {works.length ? (
        <>
          <div className={styles.resultsHeader}>
            <h2>保存したサンプル作品</h2>
            <span className={styles.count} role="status">
              {works.length}
              <small>作品</small>
            </span>
          </div>
          <div className={styles.workGrid}>
            {works.map((w) => (
              <WorkCard work={w} key={w.documentID} />
            ))}
          </div>
        </>
      ) : (
        <div className="empty-state">
          <Bookmark size={36} />
          <h2>まだ、まっさらなライブラリ。</h2>
          <p>作品のしおりボタンから、気になる問いを保存できます。</p>
          <Link to="/preview/explore" className="button primary">
            作品を探す
            <ArrowRight size={16} />
          </Link>
        </div>
      )}
    </div>
  );
}
export function WorkPage() {
  const { id } = useParams(),
    [params] = useSearchParams(),
    { saved, toggle } = usePreviewLibrary(),
    work = SAMPLE_WORKS.find((w) => w.documentID === id),
    from = params.get('from'),
    back = from?.startsWith('/preview/explore') ? from : '/preview/explore';
  if (!work)
    return (
      <div className="page-container empty-state">
        <h1>サンプル作品が見つかりません</h1>
        <Link className="button secondary" to="/preview/explore">
          作品を探す
        </Link>
      </div>
    );
  return (
    <div className={`page-container ${styles.detail}`}>
      <Link className={styles.back} to={back}>
        <ArrowLeft size={16} />
        一覧へ戻る
      </Link>
      <div className={styles.detailGrid}>
        <div className={styles.detailCover} data-category={work.category1}>
          <CategoryArt category={work.category1} />
          <span>{categoryLabel(work.category1)}</span>
          <h2>{work.title}</h2>
          <small>SAMPLE INQUIRY / {work.enterYear}</small>
        </div>
        <section className={styles.detailInfo}>
          <span className="eyebrow">SAMPLE WORK</span>
          <p className={styles.detailMeta}>
            {work.enterYear}年度入学 · {work.course === 'tankyu' ? '探究科' : '普通科'}
          </p>
          <h1>{work.title}</h1>
          <p className={styles.author}>{work.author}</p>
          <button
            className={`button ${saved.has(work.documentID) ? 'secondary' : 'primary'}`}
            onClick={() => toggle(work.documentID)}
            aria-pressed={saved.has(work.documentID)}
          >
            <Bookmark size={17} />
            {saved.has(work.documentID) ? '保存を取り消す' : 'ライブラリに保存'}
          </button>
          <div className={styles.summary}>
            <h2>このサンプルについて</h2>
            <p>{work.summary}</p>
          </div>
          <div className={styles.documents}>
            <h2>資料</h2>
            {documentTypes(work).map((kind) => (
              <div key={kind}>
                <BookOpen size={18} />
                <span>{DOCUMENT_LABELS[kind]}</span>
                <small>プレビューにPDFは含まれません</small>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
