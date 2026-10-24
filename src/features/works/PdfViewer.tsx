import { useEffect, useRef, useState, useContext } from 'react';
import type {
  EmbedPdfContainer,
  DocumentManagerPlugin,
  TilingPlugin,
  ScrollPlugin,
  PDFViewerConfig,
  ZoomMode,
  UIPlugin,
} from '@embedpdf/react-pdf-viewer';
import { ReaderContext } from './reader-context';
import { useTheme } from '../../lib/theme';
import styles from './WorkPage.module.css';

const ROOT = new URL('/embedpdf/2.15.1', location.origin).href;
type Documents = ReturnType<DocumentManagerPlugin['provides']>;
type UI = ReturnType<UIPlugin['provides']>;
interface Runtime {
  documents: Documents;
  ui: UI;
  loaded: Map<Blob, { id: string; promise: Promise<void> }>;
  painted: Set<string>;
  nextId: number;
  scroll: ReturnType<ScrollPlugin['provides']>;
  layouts: Set<string>;
}
export default function PdfViewer({
  blob,
  onReady,
  visible = true,
  pageRequest,
}: {
  blob: Blob;
  onReady: () => void;
  visible?: boolean;
  pageRequest?: { page: number; nonce: number } | null | undefined;
}) {
  const host = useRef<HTMLDivElement>(null);
  const viewer = useRef<EmbedPdfContainer | null>(null);
  const runtime = useRef<Promise<Runtime> | null>(null);
  const ready = useRef(onReady);
  const active = useRef<Blob | null>(null);
  const notify = useRef<(() => void) | null>(null);
  const [error, setError] = useState('');
  const { theme } = useTheme();
  const reader = useContext(ReaderContext);
  const bindSearch = reader?.bindSearch;
  const shown = visible && reader?.pdfVisible !== false;
  const desiredPage = useRef(pageRequest);
  const jump = useRef<(() => void) | null>(null);
  const appliedJump = useRef('');
  const [referencePage, setReferencePage] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  useEffect(() => {
    desiredPage.current = pageRequest;
    jump.current?.();
  }, [pageRequest]);
  useEffect(() => {
    ready.current = onReady;
  }, [onReady]);
  useEffect(() => {
    viewer.current?.setTheme(theme);
  }, [theme]);
  // One worker/engine for the current work. Changing documents does not recreate it.
  useEffect(() => {
    let closed = false;
    let instance: EmbedPdfContainer | undefined;
    const cleanups: (() => void)[] = [];
    runtime.current = (async () => {
      const { loadViewer } = await import('./pdf-runtime');
      const EmbedPDF = await loadViewer();
      if (closed || !host.current) throw new Error('viewer_closed');
      const config: PDFViewerConfig = {
        worker: true,
        wasmUrl: `${ROOT}/pdfium.wasm`,
        tabBar: 'never',
        theme: {
          preference: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
        },
        i18n: { defaultLocale: 'ja', fallbackLocale: 'en' },
        fonts: { ui: null, signature: null },
        stamp: { libraries: [], manifests: [], defaultLibrary: false },
        fontFallback: {
          fonts: {
            128: [
              { url: `${ROOT}/fonts/NotoSansJP-Regular.otf`, weight: 400 },
              { url: `${ROOT}/fonts/NotoSansJP-Bold.otf`, weight: 700 },
            ],
          },
          defaultFont: [
            { url: `${ROOT}/fonts/NotoSans-Regular.ttf`, weight: 400 },
            { url: `${ROOT}/fonts/NotoSans-Bold.ttf`, weight: 700 },
            { url: `${ROOT}/fonts/NotoSans-Italic.ttf`, weight: 400, italic: true },
            { url: `${ROOT}/fonts/NotoSans-BoldItalic.ttf`, weight: 700, italic: true },
          ],
        },
        disabledCategories: [
          'annotation',
          'form',
          'redaction',
          'insert',
          'history',
          'capture',
          'security',
          'document-open',
          'document-close',
          'document-print',
          'document-export',
          'document-capture',
          'document-protect',
          'panel-comment',
          'attachment',
        ],
        permissions: {
          overrides: {
            print: false,
            printHighQuality: false,
            modifyContents: false,
            modifyAnnotations: false,
            fillForms: false,
            assembleDocument: false,
          },
        },
        documentManager: { maxDocuments: 4 },
        zoom: { defaultZoomLevel: 'fit-width' as ZoomMode, minZoom: 0.25, maxZoom: 4 },
      };

      instance = EmbedPDF.init({ type: 'container', target: host.current, ...config });
      if (!instance) throw new Error('viewer_init');
      viewer.current = instance;
      const registry = await instance.registry;
      if (closed) throw new Error('viewer_closed');
      const ui = registry.getPlugin<UIPlugin>('ui')!.provides();
      const schema = ui.getSchema();
      ui.mergeSchema({
        toolbars: Object.fromEntries(
          Object.entries(schema.toolbars).map(([id, toolbar]) => [
            id,
            { ...toolbar, permanent: false },
          ]),
        ),
        overlays: Object.fromEntries(
          Object.entries(schema.overlays ?? {}).map(([id, overlay]) => [
            id,
            { ...overlay, defaultEnabled: false },
          ]),
        ),
      });
      const documents = registry.getPlugin<DocumentManagerPlugin>('document-manager')!.provides();
      const scroll = registry.getPlugin<ScrollPlugin>('scroll')!.provides();
      const state: Runtime = {
        documents,
        ui,
        scroll,
        layouts: new Set(),
        loaded: new Map(),
        painted: new Set(),
        nextId: 0,
      };
      cleanups.push(
        scroll.onLayoutReady(({ documentId }) => {
          state.layouts.add(documentId);
          jump.current?.();
        }),
      );
      cleanups.push(
        scroll.onPageChange(({ documentId, pageNumber }) => {
          if (active.current && state.loaded.get(active.current)?.id === documentId) {
            setCurrentPage(pageNumber);
            if (desiredPage.current) setReferencePage(pageNumber);
          }
        }),
      );
      const tiling = registry.getPlugin<TilingPlugin>('tiling')!.provides();
      cleanups.push(
        tiling.onTileRendering(({ documentId, tiles }) => {
          if (Object.values(tiles).some((page) => page.some((tile) => tile.status === 'ready'))) {
            state.painted.add(documentId);
            notify.current?.();
          }
        }),
      );
      cleanups.push(
        documents.onDocumentError(() => {
          if (!closed) {
            bindSearch?.(null);
            setError('PDFを表示できませんでした。資料をダウンロードして確認することもできます。');
          }
        }),
      );
      return state;
    })();
    // The selection effect handles initialization errors; always attach a rejection handler.
    void runtime.current.catch(() => {});
    return () => {
      closed = true;
      cleanups.forEach((unsubscribe) => unsubscribe());
      bindSearch?.(null);
      instance?.remove();
      viewer.current = null;
      runtime.current = null;
    };
  }, [bindSearch]);
  useEffect(() => {
    if (!shown) {
      bindSearch?.(null);
      return;
    }
    let closed = false;
    let notified = false;
    active.current = blob;
    const fail = () => {
      if (!closed) {
        bindSearch?.(null);
        setError('PDFを表示できませんでした。資料をダウンロードして確認することもできます。');
      }
    };
    const timer = setTimeout(fail, 30_000);
    void (async () => {
      try {
        const state = await runtime.current;
        if (!state || closed) return;
        let entry = state.loaded.get(blob);
        if (!entry) {
          if (state.loaded.size >= 4) throw new Error('document_limit');
          const id = `work-${state.nextId++}`;
          const promise = (async () => {
            const buffer = await blob.arrayBuffer();
            if (closed) throw new Error('selection_closed');
            const opened = await state.documents
              .openDocumentBuffer({
                buffer,
                name: '探究資料.pdf',
                documentId: id,
                autoActivate: false,
              })
              .toPromise();
            const doc = await opened.task.toPromise();
            if (!doc.pages.length || doc.pages.length > 1000) throw new Error('invalid_document');
          })();
          entry = { id, promise };
          state.loaded.set(blob, entry);
          void promise.catch(() => {
            state.loaded.delete(blob);
          });
        }
        await entry.promise;
        if (closed || active.current !== blob) return;
        const id = entry.id;
        notify.current = () => {
          if (closed || notified || !state.painted.has(id)) return;
          notified = true;
          clearTimeout(timer);
          ready.current();
        };
        jump.current = () => {
          const target = desiredPage.current;
          if (closed || !target || !state.layouts.has(id) || active.current !== blob) return;
          const key = `${id}:${target.nonce}`;
          if (appliedJump.current === key) return;
          const scope = state.scroll.forDocument(id);
          if (target.page < 1 || target.page > scope.getTotalPages()) {
            setError('参照ページを確認できませんでした。資料を開いて確認してください。');
            return;
          }
          scope.scrollToPage({ pageNumber: target.page, behavior: 'instant' });
          if (scope.getCurrentPage() === target.page) appliedJump.current = key;
          setCurrentPage(scope.getCurrentPage());
          setReferencePage(scope.getCurrentPage());
        };
        state.documents.setActiveDocument(id);
        // Wait for the newly active viewport to receive its layout before jumping.
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
        if (closed) return;
        jump.current?.();
        bindSearch?.({
          toggle: () => state.ui.forDocument(id).toggleSidebar('right', 'main', 'search-panel'),
        });
        setError('');
        notify.current();
      } catch {
        fail();
      }
    })();
    return () => {
      closed = true;
      clearTimeout(timer);
      notify.current = null;
      jump.current = null;
      bindSearch?.(null);
    };
  }, [blob, bindSearch, shown]);
  return (
    <section aria-label="PDFビューア" className={styles.viewerContainer} data-pdf-page={currentPage}>
      {shown && pageRequest && referencePage !== null && !error && (
        <p className={styles.referencePage} role="status">参照先 · {pageRequest.page}ページ</p>
      )}
      {error && (
        <div role="alert" className="empty-state">
          <p>{error}</p>
        </div>
      )}
      <div
        ref={host}
        className={styles.embedViewer}
        style={error ? { display: 'none' } : undefined}
      />
    </section>
  );
}
