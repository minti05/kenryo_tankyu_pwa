import { RelatedWorks } from './RelatedWorks';
import { Modal } from '../../components/Modal';
import { WorkActions } from '../library/WorkActions';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
} from 'react';
import { Search, Maximize, Minimize, Triangle } from 'lucide-react';
import { AiSummary } from './AiSummary';
import { ReaderSheet } from './ReaderSheet';
import { sheetBounds } from './reader-sheet-bounds';
import { useDesktopReader, useWideReader } from './reader-layout';
import type {
  WorkSummaryDto,
  WorkSummaryEvidenceDto,
  WorkDocumentDto,
} from '../../contracts/documents.generated';
import { WorkHeading } from './WorkHeading';
import { ReaderContext, type ReaderSearch } from './reader-context';
import { CATEGORY_CATALOG } from '../../contracts/catalog.generated';
import { DOCUMENT_LABELS, orderDocuments } from '../discovery/search';
import type { SearchWorkDto } from '../../contracts/discovery.generated';
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
  const documents = orderDocuments(suppliedDocuments),
    desktop = useDesktopReader(),
    wide = useWideReader();
  const [sheetOpen, setSheetOpen] = useState(false),
    [sheetHeight, setSheetHeight] = useState(() =>
      Math.max(sheetBounds().min, Math.min(sheetBounds().max, 360, window.innerHeight * 0.42)),
    );
  const [reportOpen, setReportOpen] = useState(false);
  const [progress, setProgress] = useState(0),
    [atEnd, setAtEnd] = useState(false),
    [titleHeight, setTitleHeight] = useState(100),
    [headerHeight, setHeaderHeight] = useState(68);
  const [fullscreen, setFullscreen] = useState(false),
    [controls, setControls] = useState(true),
    [search, bindSearch] = useState<ReaderSearch | null>(null);
  const root = useRef<HTMLDivElement>(null),
    screenButton = useRef<HTMLButtonElement>(null),
    native = useRef(false),
    point = useRef<{ id: number; x: number; y: number } | null>(null),
    sheetId = useId();
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

  useEffect(() => {
    const heading = root.current?.querySelector('h1'),
      header = document.querySelector('.site-header');
    const resize = () => {
      if (heading) setTitleHeight(Math.max(36, heading.getBoundingClientRect().height) + 24);
      if (header) setHeaderHeight(header.getBoundingClientRect().height);
      setSheetHeight((h) => Math.max(sheetBounds().min, Math.min(sheetBounds().max, h)));
    };
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(resize);
    };
    const observer = new ResizeObserver(schedule);
    if (heading) observer.observe(heading);
    if (header) observer.observe(header);
    window.addEventListener('resize', schedule);
    resize();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', schedule);
      cancelAnimationFrame(frame);
    };
  }, []);
  const [sheetMoving, setSheetMoving] = useState(false);
  const changeSheet = (open: boolean) => {
    setSheetMoving(true);
    setSheetOpen(open);
  };
  const previousSheet = useRef(false);
  useEffect(() => {
    if (previousSheet.current === sheetOpen) return;
    previousSheet.current = sheetOpen;
    if (sheetOpen && !desktop) window.scrollTo({ top: 0, behavior: 'smooth' });
    const timer = window.setTimeout(() => setSheetMoving(false), 380);
    return () => window.clearTimeout(timer);
  }, [sheetOpen, desktop]);
  useEffect(() => {
    const shell = root.current?.closest('.app-shell');
    if (!(shell instanceof HTMLElement)) return;
    shell.style.setProperty('--reader-header-size', `${headerHeight}px`);
    shell.classList.toggle('reader-sheet-open', !desktop && sheetOpen && !fullscreen);
    return () => {
      shell.classList.remove('reader-sheet-open');
      shell.style.removeProperty('--reader-header-size');
    };
  }, [sheetOpen, desktop, fullscreen, headerHeight]);
  const bottom = useRef(false),
    touchY = useRef<number | null>(null);
  const continueBelow = (delta: number) => {
    if (desktop || fullscreen || delta <= 0 || !bottom.current) return;
    const before = window.scrollY;
    requestAnimationFrame(() => {
      if (window.scrollY === before && bottom.current)
        window.scrollBy({ top: delta, behavior: 'instant' });
    });
  };
  const reportScroll = useCallback(({ top, remaining }: { top: number; remaining: number }) => {
    setProgress(Math.round(Math.max(0, Math.min(1, top / 80)) * 100) / 100);
    bottom.current = remaining < 8;
    if (remaining < 8) setAtEnd(true);
  }, []);
  const openReference = (reference: WorkSummaryEvidenceDto) => {
    setAtEnd(false);
    onReference?.(reference);
    if (!desktop) window.scrollTo({ top: 0, behavior: 'instant' });
  };
  const category = (id: string) => CATEGORY_CATALOG.find((item) => item.id === id);
  const subcategory = (id: string, sub: string) =>
    category(id)?.subcategories.find((item) => item.id === sub)?.label ?? 'なし';
  const information = work && (
    <section className={styles.information} aria-label="作品の情報">
      <h2>{work.title}</h2>
      <dl>
        {[
          ['名前', work.author],
          ['入学年度', `${work.enterYear}年度`],
          ['学科', work.course === 'tankyu' ? '探究科' : '普通科'],
          ['カテゴリ1', category(work.category1)?.label ?? 'なし'],
          ['サブカテゴリ1', subcategory(work.category1, work.subCategory1)],
          ...(work.category2 !== 'none'
            ? [
                ['カテゴリ2', category(work.category2)?.label ?? 'なし'],
                ['サブカテゴリ2', subcategory(work.category2, work.subCategory2)],
              ]
            : []),
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {summary?.keywords?.length ? (
        <div className={styles.keywords} aria-label="キーワード">
          {summary.keywords.map((k) => (
            <span key={k}>{k}</span>
          ))}
        </div>
      ) : null}
    </section>
  );
  const summaryContent = summary ? (
    <AiSummary summary={summary} onReference={openReference} />
  ) : (
    <p className={styles.noSummary}>{work?.summary ?? 'この作品のAI要約はまだありません。'}</p>
  );
  const insights = (
    <>
      {summaryContent}
      {work && <RelatedWorks key={work.documentID} id={work.documentID} />}
    </>
  );
  const detailAction = (
    <button
      className={styles.detailsToggle}
      data-stable-press
      aria-label={sheetOpen ? '作品の補足を閉じる' : '作品の詳細を見る'}
      aria-expanded={sheetOpen}
      aria-controls={sheetId}
      onClick={() => changeSheet(!sheetOpen)}
    >
      <Triangle
        size={12}
        fill="currentColor"
        className={sheetOpen ? styles.triangleUp : styles.triangleDown}
      />
    </button>
  );
  const collapsed = sheetOpen ? 1 : progress;
  return (
    <ReaderContext.Provider
      value={{
        bindSearch,
        pdfVisible: true,
        onScroll: reportScroll,
        reportDocument: () => setReportOpen(true),
      }}
    >
      {reportOpen && work && (
        <Modal title="PDFの問題を報告" onClose={() => setReportOpen(false)}>
          <WorkActions work={work} initialKind="pdf" initialDocument={kind} />
        </Modal>
      )}
      <div
        ref={root}
        className={`${styles.workPage} ${fullscreen ? styles.fullscreen : ''}`}
        style={
          {
            '--reader-header-height': `${!desktop && sheetOpen ? 0 : headerHeight}px`,
            '--title-space': `${desktop ? titleHeight : Math.max(0, titleHeight * (1 - collapsed))}px`,
            '--title-opacity': 1 - collapsed,
            '--sheet-height': `${!desktop && sheetOpen && !fullscreen ? sheetHeight : 0}px`,
          } as CSSProperties
        }
        data-reader-fullscreen={fullscreen}
        data-sheet-open={sheetOpen}
        data-sheet-moving={sheetMoving}
        data-title-collapsed={collapsed > 0.9}
      >
        <aside className={styles.leftRail} aria-label="作品情報欄">
          {work ? (
            <WorkHeading
              work={work}
              kind={kind}
              documents={documents}
              detailAction={desktop ? undefined : detailAction}
              collapsed={collapsed}
              sheetOpen={sheetOpen}
              onOpenDetails={() => changeSheet(true)}
            />
          ) : (
            <header className={styles.intro}>
              <h1>保存した資料</h1>
            </header>
          )}
          <div className={styles.workDetails}>{information}</div>
          {desktop && !wide && (
            <aside className={styles.insights} aria-label="要約と関連作品">
              {insights}
            </aside>
          )}
        </aside>
        <div className={styles.readingColumn}>
          <div className={styles.readerBar}>
            <div className={styles.tabs} role="group" aria-label="資料の種類">
              {documents.map((doc) => (
                <button
                  key={doc.kind}
                  aria-pressed={kind === doc.kind}
                  onClick={() => {
                    setAtEnd(false);
                    onKind(doc.kind);
                  }}
                >
                  {DOCUMENT_LABELS[doc.kind]}
                </button>
              ))}
            </div>
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
          <div
            className={styles.documentSurface}
            data-reader-surface
            onWheelCapture={(e) => {
              if (!e.ctrlKey) continueBelow(e.deltaY);
            }}
            onTouchStartCapture={(e) => {
              touchY.current = e.touches.length === 1 ? e.touches[0]!.clientY : null;
            }}
            onTouchMoveCapture={(e) => {
              if (touchY.current !== null && e.touches.length === 1) {
                const next = e.touches[0]!.clientY;
                continueBelow(touchY.current - next);
                touchY.current = next;
              }
            }}
            onPointerDownCapture={(event) => {
              if (event.isPrimary)
                point.current = {
                  id: event.pointerId,
                  x: event.clientX,
                  y: event.clientY,
                };
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
            <div className={styles.pdfContent}>{children}</div>
            {!fullscreen && controls && (
              <button
                className={`${styles.roundButton} ${styles.searchFloat}`}
                aria-label="PDF内を検索"
                disabled={!search}
                onClick={() => search?.toggle()}
              >
                <Search size={21} />
              </button>
            )}
            {(controls || fullscreen) && (
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
            <button className={styles.srControl} onClick={() => setControls((v) => !v)}>
              {controls ? 'PDF操作ボタンを隠す' : 'PDF操作ボタンを表示'}
            </button>
          </div>
        </div>
        {desktop && wide && (
          <aside className={styles.insights} aria-label="要約と関連作品">
            {insights}
          </aside>
        )}
        {!desktop &&
          !fullscreen &&
          !sheetOpen &&
          work &&
          (atEnd || !documents.some((d) => d.state === 'available')) && (
            <div className={styles.afterDocument} data-after-pdf>
              <RelatedWorks key={work.documentID} id={work.documentID} />
            </div>
          )}
        {!desktop && !fullscreen && sheetOpen && (
          <div id={sheetId}>
            <ReaderSheet
              height={sheetHeight}
              onHeight={setSheetHeight}
              onClose={() => changeSheet(false)}
              summary={summaryContent}
              information={information}
              related={work && <RelatedWorks key={work.documentID} id={work.documentID} />}
            />
          </div>
        )}
      </div>
    </ReaderContext.Provider>
  );
}
