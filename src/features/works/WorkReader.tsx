import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Search, Maximize, Minimize, Triangle } from 'lucide-react';
import { AiSummary } from './AiSummary';
import { useDesktopReader } from './reader-layout';
import type { WorkSummaryDto, WorkSummaryEvidenceDto } from '../../contracts/documents.generated';
import { WorkHeading } from './WorkHeading';
import { ReaderContext, type ReaderSearch } from './reader-context';
import { CATEGORY_CATALOG } from '../../contracts/catalog.generated';
import { DOCUMENT_LABELS, orderDocuments } from '../discovery/search';
import type { SearchWorkDto } from '../../contracts/discovery.generated';
import type { WorkDocumentDto } from '../../contracts/documents.generated';
import styles from './WorkPage.module.css';

export function WorkReader({
  work,
  kind,
  documents: suppliedDocuments,
  onKind,
  children,
  summary,
  onReference,
}: {
  work?: SearchWorkDto | undefined;
  kind?: string | undefined;
  documents: WorkDocumentDto[];
  onKind: (kind: string) => void;
  children: ReactNode;
  summary?: WorkSummaryDto | null | undefined;
  onReference?: (reference: WorkSummaryEvidenceDto) => void;
}) {
  const documents = orderDocuments(suppliedDocuments);
  const desktop = useDesktopReader();
  const [summarySelected, setSummarySelected] = useState(false);
  const showSummary = !!summary && summarySelected && !desktop;
  const [expanded, setExpanded] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [controls, setControls] = useState(true);
  const [search, bindSearch] = useState<ReaderSearch | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const screenButton = useRef<HTMLButtonElement>(null);
  const native = useRef(false);
  const point = useRef<{ id: number; x: number; y: number } | null>(null);
  const detailsId = useId();
  const closeScreen = useCallback(() => {
    setFullscreen(false);
    setControls(true);
    if (document.fullscreenElement === root.current) void document.exitFullscreen().catch(() => {});
    screenButton.current?.focus();
  }, []);
  useEffect(() => {
    if (!fullscreen) return;
    const before = document.body.style.overflow;
    const header = document.querySelector<HTMLElement>('.site-header');
    const wasInert = header?.inert;
    if (header) header.inert = true;
    document.body.style.overflow = 'hidden';
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeScreen();
    };
    const changed = () => {
      if (document.fullscreenElement === root.current) native.current = true;
      else if (native.current) {
        native.current = false;
        closeScreen();
      }
    };
    document.addEventListener('keydown', escape);
    document.addEventListener('fullscreenchange', changed);
    return () => {
      document.body.style.overflow = before;
      if (header) header.inert = wasInert ?? false;
      document.removeEventListener('keydown', escape);
      document.removeEventListener('fullscreenchange', changed);
    };
  }, [fullscreen, closeScreen]);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const resize = () => {
      const surface = element.querySelector<HTMLElement>('[data-reader-surface]');
      if (surface)
        element.style.setProperty(
          '--reader-top',
          `${Math.max(0, surface.getBoundingClientRect().top + window.scrollY)}px`,
        );
    };
    const observer = new ResizeObserver(resize);
    if (bar.current) observer.observe(bar.current);
    const title = element.querySelector('h1');
    if (title) observer.observe(title);
    resize();
    window.addEventListener('resize', resize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, [expanded, fullscreen]);
  const toggleScreen = () => {
    if (fullscreen) {
      closeScreen();
      return;
    }
    setFullscreen(true);
    setControls(true);
    // iPhone browsers without element fullscreen use the same viewport-filling layout.
    if (root.current?.requestFullscreen)
      void root.current
        .requestFullscreen()
        .then(() => {
          native.current = document.fullscreenElement === root.current;
        })
        .catch(() => {});
  };
  const openReference = (reference: WorkSummaryEvidenceDto) => {
    setSummarySelected(false);
    onReference?.(reference);
    if (!desktop)
      requestAnimationFrame(() =>
        root.current
          ?.querySelector('[data-reader-surface]')
          ?.scrollIntoView({ block: 'start', behavior: 'smooth' }),
      );
  };
  const category = (id: string) => CATEGORY_CATALOG.find((item) => item.id === id);
  const subcategory = (id: string, sub: string) =>
    category(id)?.subcategories.find((item) => item.id === sub)?.label ?? 'なし';
  return (
    <ReaderContext.Provider value={{ bindSearch, pdfVisible: !showSummary }}>
      <div
        ref={root}
        className={`${styles.workPage} ${fullscreen ? styles.fullscreen : ''}`}
        data-reader-fullscreen={fullscreen}
      >
        {work ? (
          <WorkHeading work={work} kind={kind} documents={documents} />
        ) : (
          <header className={styles.intro}>
            <h1>保存した資料</h1>
          </header>
        )}
        <div ref={bar} className={styles.readerBar}>
          <div className={styles.tabs} role="group" aria-label="資料の種類">
            {summary && !desktop && !fullscreen && (
              <button aria-pressed={showSummary} onClick={() => setSummarySelected(true)}>
                AI要約
              </button>
            )}
            {documents.map((doc) => (
              <button
                key={doc.kind}
                aria-pressed={!showSummary && kind === doc.kind}
                onClick={() => {
                  setSummarySelected(false);
                  onKind(doc.kind);
                }}
              >
                {DOCUMENT_LABELS[doc.kind]}
              </button>
            ))}
          </div>
          {!fullscreen && (
            <button
              className={styles.detailsToggle}
              aria-label={expanded ? '作品の詳細を閉じる' : '作品の詳細を見る'}
              aria-expanded={expanded}
              aria-controls={detailsId}
              onClick={() => setExpanded(!expanded)}
            >
              <Triangle
                size={12}
                fill="currentColor"
                className={expanded ? styles.triangleUp : styles.triangleDown}
              />
            </button>
          )}
          {fullscreen && (
            <button
              className={styles.roundButton}
              aria-label="PDF内を検索"
              disabled={!search}
              onClick={() => search?.toggle()}
            >
              <Search size={21} />
            </button>
          )}
        </div>
        {work && (
          <section
            id={detailsId}
            aria-label="作品の詳細"
            className={styles.workDetails}
            data-expanded={expanded}
          >
            <dl>
              <div>
                <dt>名前</dt>
                <dd>{work.author}</dd>
              </div>
              <div>
                <dt>入学年度</dt>
                <dd>{work.enterYear}年度</dd>
              </div>
              <div>
                <dt>学科</dt>
                <dd>{work.course === 'tankyu' ? '探究科' : '普通科'}</dd>
              </div>
              <div>
                <dt>カテゴリ1</dt>
                <dd>{category(work.category1)?.label ?? 'なし'}</dd>
              </div>
              <div>
                <dt>サブカテゴリ1</dt>
                <dd>{subcategory(work.category1, work.subCategory1)}</dd>
              </div>
              <div>
                <dt>カテゴリ2</dt>
                <dd>{category(work.category2)?.label ?? 'なし'}</dd>
              </div>
              <div>
                <dt>サブカテゴリ2</dt>
                <dd>{subcategory(work.category2, work.subCategory2)}</dd>
              </div>
            </dl>
            {!summary && work.summary && (
              <div className={styles.summary}>
                <h2>この探究について</h2>
                <p>{work.summary}</p>
              </div>
            )}
            {summary && desktop && onReference && (
              <div className={styles.aiSidebar}>
                <AiSummary summary={summary} onReference={openReference} />
              </div>
            )}
          </section>
        )}
        <div
          className={styles.documentSurface}
          data-reader-surface
          onPointerDownCapture={(event) => {
            if (event.isPrimary)
              point.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
            else point.current = null;
          }}
          onPointerCancelCapture={() => {
            point.current = null;
          }}
          onPointerUpCapture={(event) => {
            const start = point.current;
            point.current = null;
            if (
              !start ||
              start.id !== event.pointerId ||
              Math.hypot(start.x - event.clientX, start.y - event.clientY) > 8
            )
              return;
            const path = event.nativeEvent.composedPath();
            if (
              path.some(
                (node) =>
                  node instanceof Element &&
                  node.matches(
                    'button,input,a,textarea,select,[role="button"],[role="menuitem"],[role="checkbox"]',
                  ),
              )
            )
              return;
            if (window.getSelection()?.toString()) return;
            setControls((value) => !value);
          }}
        >
          <div className={styles.pdfContent} hidden={showSummary}>
            {children}
          </div>
          {showSummary && summary && (
            <div className={styles.aiPanel}>
              <AiSummary summary={summary} onReference={openReference} />
            </div>
          )}
          {!showSummary && !fullscreen && controls && (
            <button
              className={`${styles.roundButton} ${styles.searchFloat}`}
              aria-label="PDF内を検索"
              disabled={!search}
              onClick={() => search?.toggle()}
            >
              <Search size={21} />
            </button>
          )}
          {!showSummary && (controls || fullscreen) && (
            <button
              ref={screenButton}
              className={`${styles.roundButton} ${styles.fullscreenFloat}`}
              aria-label={fullscreen ? '全画面表示を解除' : '全画面表示'}
              aria-pressed={fullscreen}
              disabled={!fullscreen && !search}
              onClick={toggleScreen}
            >
              {fullscreen ? <Minimize size={21} /> : <Maximize size={21} />}
            </button>
          )}
          <button className={styles.srControl} onClick={() => setControls((value) => !value)}>
            {controls ? 'PDF操作ボタンを隠す' : 'PDF操作ボタンを表示'}
          </button>
        </div>
      </div>
    </ReaderContext.Provider>
  );
}
