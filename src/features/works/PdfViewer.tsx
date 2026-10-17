import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import styles from './WorkPage.module.css';
export default function PdfViewer({ blob, onReady }: { blob: Blob; onReady: () => void }) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null),
    [page, setPage] = useState(1),
    [zoom, setZoom] = useState(1),
    [error, setError] = useState(''),
    [rendering, setRendering] = useState(true),
    [text, setText] = useState(''),
    [width, setWidth] = useState(600);
  const canvas = useRef<HTMLCanvasElement>(null),
    container = useRef<HTMLDivElement>(null),
    ready = useRef(onReady);
  useEffect(() => {
    ready.current = onReady;
  }, [onReady]);
  useEffect(() => {
    let closed = false;
    let task: Awaited<ReturnType<(typeof import('./pdf-runtime'))['loadPdf']>> | undefined;
    const timer = setTimeout(() => {
      if (!closed) {
        setError('表示に時間がかかっています。資料をダウンロードして確認することもできます。');
        void task?.destroy();
      }
    }, 20_000);
    void (async () => {
      try {
        const { loadPdf } = await import('./pdf-runtime');
        if (closed) return;
        task = await loadPdf(new Uint8Array(await blob.arrayBuffer()));
        if (closed) {
          await task.destroy();
          return;
        }
        const pdf = await task.promise;
        if (pdf.numPages > 1000) throw new Error('too_many_pages');
        if (!closed) {
          setDoc(pdf);
          clearTimeout(timer);
        }
      } catch (e) {
        if (!closed) {
          clearTimeout(timer);
          setError(
            e && typeof e === 'object' && 'name' in e && e.name === 'PasswordException'
              ? 'パスワード付きの資料は表示できません。運営者へ確認してください。'
              : 'PDFを表示できませんでした。資料の形式を運営者へ確認してください。',
          );
        }
      }
    })();
    return () => {
      closed = true;
      clearTimeout(timer);
      void task?.destroy();
    };
  }, [blob]);
  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) =>
      setWidth(Math.max(200, Math.floor(entries[0]!.contentRect.width))),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!doc || !canvas.current) return;
    let cancelled = false,
      task: RenderTask | undefined;
    const element = canvas.current;
    const timer = setTimeout(() => {
      if (!cancelled) {
        task?.cancel();
        setError('ページの表示に時間がかかっています。資料をダウンロードして確認してください。');
      }
    }, 20_000);
    void (async () => {
      setRendering(true);
      setText('');
      try {
        const p = await doc.getPage(page);
        if (cancelled) return;
        const original = p.getViewport({ scale: 1 }),
          cssScale = Math.max(0.1, (width - 24) / original.width) * zoom,
          desired = cssScale * Math.min(devicePixelRatio || 1, 2),
          scale = Math.min(
            desired,
            Math.sqrt(4_000_000 / (original.width * original.height)),
            4096 / Math.max(original.width, original.height),
          );
        const v = p.getViewport({ scale });
        element.width = Math.max(1, Math.floor(v.width));
        element.height = Math.max(1, Math.floor(v.height));
        element.style.width = `${original.width * cssScale}px`;
        element.style.height = `${original.height * cssScale}px`;
        task = p.render({ canvas: element, viewport: v });
        await task.promise;
        if (cancelled) return;
        clearTimeout(timer);
        setRendering(false);
        ready.current();
        const content = await p.getTextContent();
        if (!cancelled)
          setText(
            content.items
              .map((i) => ('str' in i ? i.str : ''))
              .join(' ')
              .slice(0, 50_000),
          );
      } catch (e) {
        if (
          !cancelled &&
          !(e && typeof e === 'object' && 'name' in e && e.name === 'RenderingCancelledException')
        )
          setError('このページを表示できませんでした。資料をダウンロードして確認してください。');
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      task?.cancel();
      element.width = 0;
      element.height = 0;
    };
  }, [doc, page, zoom, width]);
  if (error)
    return (
      <div role="alert" className="empty-state">
        <p>{error}</p>
      </div>
    );
  return (
    <section aria-label="PDFビューア">
      <div className={styles.toolbar}>
        <button disabled={!doc || page <= 1 || rendering} onClick={() => setPage((p) => p - 1)}>
          前のページ
        </button>
        <span role="status">
          {doc ? `${page} / ${doc.numPages} ページ` : 'PDFを読み込んでいます…'}
        </span>
        <button
          disabled={!doc || page >= doc.numPages || rendering}
          onClick={() => setPage((p) => p + 1)}
        >
          次のページ
        </button>
        <label>
          拡大率
          <select
            aria-label="拡大率"
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          >
            {[0.75, 1, 1.5, 2, 3].map((n) => (
              <option key={n} value={n}>
                {n === 1 ? '幅に合わせる' : `${n * 100}%`}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div
        ref={container}
        className={styles.viewport}
        role="region"
        aria-label="PDF表示。拡大後は縦横にスクロールできます"
        tabIndex={0}
      >
        <canvas ref={canvas} aria-label={`PDF ${page}ページ目`} />
      </div>
      {rendering && <p role="status">ページを描画しています…</p>}
      <details>
        <summary>このページの文字を読む</summary>
        <p className={styles.pageText}>
          {text || '文字情報のないページ、または読み込み中です。画像として内容を確認してください。'}
        </p>
      </details>
    </section>
  );
}
