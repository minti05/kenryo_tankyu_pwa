import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/context';
import type { WorkDetailDto, WorkDocumentDto } from '../../contracts/documents.generated';
import { CategoryArt } from '../../components/CategoryArt';
import { categoryLabel, DOCUMENT_LABELS } from '../discovery/search';
import { ApiError } from '../../lib/api-client';
import { readPdfResponse, safePdfName, type PdfData } from './pdf-data';
import styles from './WorkPage.module.css';
const PdfViewer = lazy(() => import('./PdfViewer'));
function message(error: unknown) {
  const code = error instanceof ApiError ? error.code : '';
  return (
    (
      {
        work_not_found: 'この作品は現在公開されていません。',
        document_not_found: '資料が見つかりません。',
        document_changed: '資料が更新されました。作品情報を読み直してください。',
        document_too_large: '資料のサイズが上限を超えています。運営者へ確認してください。',
        invalid_document: '資料の形式を確認できません。運営者へ確認してください。',
        document_hash_mismatch: '資料を正しく受信できませんでした。もう一度お試しください。',
      } as Record<string, string>
    )[code] ?? '資料を読み込めませんでした。通信を確認してお試しください。'
  );
}
function validDetail(data: WorkDetailDto, id: string) {
  if (
    data?.version !== '1' ||
    data.work?.documentID !== id ||
    !Array.isArray(data.documents) ||
    data.documents.length > 4 ||
    new Set(data.documents.map((d) => d.kind)).size !== data.documents.length ||
    data.documents.some(
      (d) =>
        !['poster', 'report', 'slide', 'thesis'].includes(d.kind) ||
        !['available', 'missing', 'too_large', 'invalid'].includes(d.state) ||
        (d.state === 'available' &&
          (!Number.isSafeInteger(d.bytes) ||
            d.bytes! < 5 ||
            d.bytes! > 3_000_000 ||
            !/^[a-f0-9]{64}$/.test(d.revision ?? ''))),
    )
  )
    throw new ApiError(502, 'invalid_response');
  return data;
}
export default function WorkPage() {
  const { id = '' } = useParams(),
    [params, setParams] = useSearchParams(),
    { session, request } = useAuth(),
    [shareStatus, setShareStatus] = useState(''),
    [manualCopy, setManualCopy] = useState('');
  const detail = useQuery({
    queryKey: ['work', session?.uid, id],
    enabled: !!session && /^\d{8}$/.test(id),
    queryFn: async ({ signal }) =>
      validDetail(await request<WorkDetailDto>('/api/works/' + id, { signal }), id),
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
  });
  const from = params.get('from'),
    back = from && /^\/(explore|awards)(\?|$)/.test(from) ? from : '/explore';
  if (!/^\d{8}$/.test(id))
    return (
      <div className="page-container empty-state">
        <h1>作品が見つかりません</h1>
        <Link to="/explore">作品を探す</Link>
      </div>
    );
  if (detail.isPending)
    return (
      <div className="loading-state" role="status">
        作品を読み込んでいます…
      </div>
    );
  if (detail.isError || !detail.data)
    return (
      <div className="page-container empty-state" role="alert">
        <h1>作品を表示できません</h1>
        <p>{message(detail.error)}</p>
        <button className="button secondary" onClick={() => void detail.refetch()}>
          作品情報を読み直す
        </button>
        <Link to={back}>一覧へ戻る</Link>
      </div>
    );
  const { work, documents } = detail.data,
    selected =
      documents.find((d) => d.kind === params.get('kind')) ??
      ['poster', 'report', 'thesis', 'slide']
        .map((kind) => documents.find((d) => d.kind === kind))
        .find(Boolean);
  async function share() {
    const url = new URL('/works/' + id, location.origin);
    if (selected) url.searchParams.set('kind', selected.kind);
    if (navigator.share) {
      try {
        await navigator.share({ title: '探究アーカイブ', url: url.href });
        setShareStatus('共有しました。');
        return;
      } catch (e) {
        if (e && typeof e === 'object' && 'name' in e && e.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url.href);
      setShareStatus('作品のリンクをコピーしました。リンク先でも学校のログインが必要です。');
    } catch {
      setManualCopy(url.href);
      setShareStatus('下のリンクを選択してコピーしてください。');
    }
  }
  return (
    <div className="page-container">
      <Link to={back} className={styles.back}>
        ← 一覧へ戻る
      </Link>
      <header className={styles.intro}>
        <CategoryArt category={work.category1} />
        <div>
          <p>
            {work.enterYear}年度入学 · {work.course === 'tankyu' ? '探究科' : '普通科'} ·{' '}
            {categoryLabel(work.category1)}
          </p>
          <h1>{work.title}</h1>
          <p>{work.author}</p>
          <button className="button secondary" onClick={() => void share()}>
            作品のリンクを共有
          </button>
          {shareStatus && <p role="status">{shareStatus}</p>}
          {manualCopy && (
            <input
              aria-label="共有する作品のリンク"
              readOnly
              value={manualCopy}
              onFocus={(e) => e.target.select()}
            />
          )}
        </div>
      </header>
      {work.summary && (
        <section className={styles.summary}>
          <h2>この探究について</h2>
          <p>{work.summary}</p>
        </section>
      )}
      <section aria-label="資料">
        <div className={styles.tabs} role="group" aria-label="資料の種類">
          {documents.map((d) => (
            <button
              key={d.kind}
              aria-pressed={selected?.kind === d.kind}
              onClick={() => {
                const next = new URLSearchParams(params);
                next.set('kind', d.kind);
                setParams(next);
              }}
            >
              {DOCUMENT_LABELS[d.kind]}
            </button>
          ))}
        </div>
        {selected ? (
          <DocumentPane
            key={`${session!.uid}:${id}:${selected.kind}:${selected.revision}`}
            id={id}
            title={work.title}
            document={selected}
            onRefresh={() => void detail.refetch()}
          />
        ) : (
          <p>この作品には閲覧できる資料がありません。</p>
        )}
      </section>
    </div>
  );
}
function DocumentPane({
  id,
  title,
  document: doc,
  onRefresh,
}: {
  id: string;
  title: string;
  document: WorkDocumentDto;
  onRefresh: () => void;
}) {
  const { requestResponse } = useAuth(),
    request = useRef(requestResponse),
    [data, setData] = useState<(PdfData & { url: string }) | null>(null),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0),
    [viewed, setViewed] = useState(false),
    [saveState, setSaveState] = useState<'idle' | 'checking' | 'ready'>('idle'),
    [saveMessage, setSaveMessage] = useState('');
  const prepared = useRef(0),
    alive = useRef(true),
    path = `/api/works/${id}/pdf/${doc.kind}?revision=${doc.revision}`;
  useEffect(() => {
    request.current = requestResponse;
  }, [requestResponse]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (doc.state !== 'available' || doc.bytes === null || !doc.revision) return;
    const controller = new AbortController();
    let objectUrl: string | undefined;
    void (async () => {
      try {
        const response = await request.current(path, {
            signal: controller.signal,
            headers: { Accept: 'application/pdf' },
          }),
          pdf = await readPdfResponse(response, { bytes: doc.bytes!, revision: doc.revision! });
        if (!controller.signal.aborted) {
          objectUrl = URL.createObjectURL(pdf.blob);
          setData({ ...pdf, url: objectUrl });
          setError('');
        }
      } catch (e) {
        if (!controller.signal.aborted) setError(message(e));
      }
    })();
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [doc.bytes, doc.revision, doc.state, path, retry]);
  async function prepare() {
    if (!data || saveState === 'checking') return;
    setSaveState('checking');
    setSaveMessage('保存する資料を確認しています…');
    try {
      const r = await request.current(path, {
        method: 'HEAD',
        headers: { Accept: 'application/pdf' },
      });
      if (
        r.headers.get('X-Document-Revision') !== data.revision ||
        Number(r.headers.get('Content-Length')) !== data.blob.size ||
        (r.headers.get('X-Content-SHA256') && r.headers.get('X-Content-SHA256') !== data.sha256)
      )
        throw new ApiError(409, 'document_changed');
      if (alive.current) {
        prepared.current = Date.now();
        setSaveState('ready');
        setSaveMessage('準備できました。下のリンクから保存してください。');
      }
    } catch (e) {
      if (alive.current) {
        setSaveState('idle');
        setSaveMessage(message(e));
      }
    }
  }
  if (doc.state !== 'available')
    return (
      <div className="empty-state" role="status">
        <p>
          {doc.state === 'too_large'
            ? '3MBを超える資料のため、現在は提供できません。'
            : doc.state === 'missing'
              ? 'この資料はまだ見つかりません。'
              : '資料の形式を確認する必要があります。'}
          運営者へ確認してください。
        </p>
        <button className="button secondary" onClick={onRefresh}>
          作品情報を読み直す
        </button>
      </div>
    );
  if (error)
    return (
      <div className="empty-state" role="alert">
        <p>{error}</p>
        <button
          className="button secondary"
          onClick={() => {
            setError('');
            setRetry((n) => n + 1);
          }}
        >
          もう一度読み込む
        </button>
        <button className="button secondary" onClick={onRefresh}>
          作品情報を読み直す
        </button>
      </div>
    );
  return (
    <>
      <p className={styles.documentMeta}>
        {DOCUMENT_LABELS[doc.kind]} · {((doc.bytes ?? 0) / 1_000_000).toFixed(2)}MB · 版{' '}
        {doc.revision?.slice(0, 8)}
      </p>
      {data ? (
        <Suspense fallback={<p role="status">PDFビューアを準備しています…</p>}>
          <PdfViewer blob={data.blob} onReady={() => setViewed(true)} />
        </Suspense>
      ) : (
        <p role="status">PDFを取得しています…</p>
      )}
      <section className={styles.download} aria-label="資料の保存" data-viewed={viewed}>
        <h2>資料を手元に</h2>
        <p>
          ダウンロードしたPDFは3日後も自動削除されません。学校の利用規約を守り、再配布や個人情報の扱いにご注意ください。
        </p>
        <p>アプリ内でのオフライン閲覧は準備中です。</p>
        <button
          className="button primary"
          disabled={!data || saveState === 'checking'}
          onClick={() => void prepare()}
        >
          ダウンロード
        </button>
        {saveMessage && <p role="status">{saveMessage}</p>}
        {saveState === 'ready' && data?.url && (
          <a
            className="button secondary"
            href={data!.url}
            download={safePdfName(id, doc.kind, title)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              if (Date.now() - prepared.current > 5000 || Date.now() < prepared.current) {
                e.preventDefault();
                void prepare();
              }
            }}
          >
            PDFを端末に保存
          </a>
        )}
        <p className={styles.hint}>
          iPadなどで保存先を選べない場合は、開いたPDFの共有メニューから「ファイルに保存」を選んでください。
        </p>
      </section>
    </>
  );
}
