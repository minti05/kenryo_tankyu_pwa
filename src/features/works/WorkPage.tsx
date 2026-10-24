import { cacheView } from '../library/cache';
import type { ViewRecordedDto } from '../../contracts/library.generated';
import { DOCUMENT_ORDER } from '../discovery/search';
import { WorkReader } from './WorkReader';
import { operation } from '../library/client';
import OfflineWorkPage from '../offline/OfflineWorkPage';
import { deleteSaved, listSaved, readSaved, saveViewed, type CacheSession } from '../offline/store';
import { preparePdfAssets } from '../offline/assets';
import type { SearchWorkDto } from '../../contracts/discovery.generated';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/context';
import type {
  WorkDetailDto,
  WorkDocumentDto,
  WorkSummaryEvidenceDto,
} from '../../contracts/documents.generated';
import { ApiError } from '../../lib/api-client';
import { readPdfResponse, type PdfData } from './pdf-data';
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
  const { offline } = useAuth();
  useEffect(() => {
    // Overlap SDK loading with metadata/authorized PDF fetches. No document or worker is retained.
    void import('./pdf-runtime').then((runtime) => runtime.loadViewer()).catch(() => {});
  }, []);
  return offline ? <OfflineWorkPage /> : <OnlineWorkPage />;
}
function OnlineWorkPage() {
  const { id = '' } = useParams(),
    [params, setParams] = useSearchParams(),
    { session, request, cacheSession } = useAuth();
  const [pageRequest, setPageRequest] = useState<{
    workId: string;
    kind: string;
    page: number;
    nonce: number;
  } | null>(null);
  const referenceSequence = useRef(0);
  const detail = useQuery({
    queryKey: ['work', session?.uid, id],
    enabled: !!session && /^\d{8}$/.test(id),
    queryFn: async ({ signal }) => {
      const data = validDetail(
        await request<WorkDetailDto>('/api/works/' + id, { signal }).catch(async (e) => {
          if (e instanceof ApiError && e.status === 404 && cacheSession)
            await deleteSaved(cacheSession, id).catch(() => {});
          throw e;
        }),
        id,
      );
      if (cacheSession)
        for (const row of await listSaved(cacheSession).catch(() => [])) {
          if (
            row.id === id &&
            !data.documents.some(
              (doc) =>
                doc.kind === row.kind && doc.state === 'available' && doc.revision === row.revision,
            )
          )
            await deleteSaved(cacheSession, id, row.kind).catch(() => {});
        }
      return data;
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
  });
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
      </div>
    );
  const { work, documents } = detail.data,
    selected =
      documents.find((d) => d.kind === params.get('kind')) ??
      DOCUMENT_ORDER.map((kind) => documents.find((d) => d.kind === kind)).find(
        (doc) => doc?.state === 'available',
      ) ??
      DOCUMENT_ORDER.map((kind) => documents.find((d) => d.kind === kind)).find(Boolean);
  return (
    <WorkReader
      key={id}
      work={work}
      summary={detail.data.summary}
      onReference={(reference: WorkSummaryEvidenceDto) => {
        const next = new URLSearchParams(params);
        next.set('kind', reference.kind);
        setPageRequest({
          workId: id,
          kind: reference.kind,
          page: reference.page,
          nonce: ++referenceSequence.current,
        });
        setParams(next, { replace: true });
      }}
      kind={selected?.kind}
      documents={documents}
      onKind={(kind) => {
        setPageRequest(null);
        const next = new URLSearchParams(params);
        next.set('kind', kind);
        setParams(next, { replace: true });
      }}
    >
      {selected ? (
        <DocumentPane
          key={`${session!.uid}:${cacheSession?.epoch}:${cacheSession?.fence}:${id}:${documents.map((d) => `${d.kind}:${d.revision}:${d.bytes}:${d.state}`).join()}`}
          id={id}
          work={work}
          document={selected}
          pageRequest={pageRequest?.workId === id && pageRequest.kind === selected.kind ? pageRequest : null}
          onRefresh={() => void detail.refetch()}
        />
      ) : (
        <p>この作品には閲覧できる資料がありません。</p>
      )}
    </WorkReader>
  );
}
function DocumentPane({
  id,
  work,
  document: doc,
  pageRequest,
  onRefresh,
}: {
  id: string;
  work: SearchWorkDto;
  document: WorkDocumentDto;
  pageRequest?: { page: number; nonce: number } | null;
  onRefresh: () => void;
}) {
  const { requestResponse, request: jsonRequest, cacheSession, session } = useAuth(),
    [savedMessage, setSavedMessage] = useState(''),
    saved = useRef(false),
    historyIntent = useRef(operation()),
    historyStatus = useRef<'idle' | 'pending' | 'done'>('idle'),
    [historyError, setHistoryError] = useState(false),
    owner = useRef<{ cache: CacheSession; session: NonNullable<typeof session> } | null>(null),
    request = useRef(requestResponse),
    [loaded, setData] = useState<{ path: string; pdf: PdfData } | null>(null),
    memory = useRef(new Map<string, PdfData>()),
    [error, setError] = useState(''),
    [selection, setSelection] = useState(''),
    [pending, setPending] = useState(true),
    [retry, setRetry] = useState(0);
  const query = useQueryClient();
  const alive = useRef(true),
    path = `/api/works/${id}/pdf/${doc.kind}?revision=${doc.revision}`;
  const data = !pending && loaded?.path === path ? loaded.pdf : null;
  if (selection !== path) {
    setSelection(path);
    setPending(true);
    setSavedMessage('');
    setHistoryError(false);
    setError('');
  }
  useEffect(() => {
    owner.current = cacheSession && session ? { cache: cacheSession, session } : null;
  }, [cacheSession, session]);
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
    saved.current = false;
    void (async () => {
      try {
        const startedMono = performance.now();
        const resident = memory.current.get(path);
        const cached =
          resident ??
          (owner.current
            ? await readSaved(owner.current.cache, id, doc.kind, doc.revision!).catch(() => null)
            : null);
        let pdf: PdfData;
        if (cached) {
          const head = await request.current(path, {
            method: 'HEAD',
            signal: controller.signal,
            headers: { Accept: 'application/pdf' },
          });
          if (
            head.headers.get('Content-Type')?.split(';')[0] !== 'application/pdf' ||
            cached.blob.size !== doc.bytes ||
            head.headers.get('X-Document-Revision') !== cached.revision ||
            Number(head.headers.get('Content-Length')) !== cached.blob.size ||
            head.headers.get('X-Content-SHA256') !== cached.sha256 ||
            !Number.isFinite(Date.parse(head.headers.get('X-Authorized-At') ?? ''))
          )
            throw new ApiError(409, 'document_changed');
          pdf = {
            blob: cached.blob,
            revision: cached.revision,
            sha256: cached.sha256,
            authorizedAt: head.headers.get('X-Authorized-At')!,
            receivedMono: startedMono,
          };
        } else {
          const response = await request.current(path, {
            signal: controller.signal,
            headers: { Accept: 'application/pdf' },
          });
          pdf = await readPdfResponse(response, {
            bytes: doc.bytes!,
            revision: doc.revision!,
            startedMono,
          });
        }
        if (!controller.signal.aborted) {
          memory.current.set(path, pdf);
          setData({ path, pdf });
          setPending(false);
          setError('');
        }
      } catch (e) {
        if (!controller.signal.aborted) {
          if (owner.current && e instanceof ApiError && [404, 409, 413, 422].includes(e.status))
            await deleteSaved(owner.current.cache, id, doc.kind).catch(() => {});
          if (controller.signal.aborted) return;
          memory.current.clear();
          setData(null);
          setError(message(e));
        }
      }
    })();
    return () => {
      controller.abort();
    };
  }, [doc.bytes, doc.revision, doc.state, doc.kind, id, path, retry]);
  async function recordView() {
    if (historyStatus.current !== 'idle') return;
    historyStatus.current = 'pending';
    try {
      const result = await jsonRequest<ViewRecordedDto>('/api/history', {
        method: 'POST',
        body: JSON.stringify({ documentID: id, ...historyIntent.current }),
      });
      if (session) await cacheView(query, session.uid, result);
      historyStatus.current = 'done';
      if (alive.current) setHistoryError(false);
    } catch {
      historyStatus.current = 'idle';
      if (alive.current) setHistoryError(true);
    }
  }
  async function onViewed() {
    void recordView();
    if (saved.current || !data || !owner.current) return;
    saved.current = true;
    const identity = owner.current;

    try {
      await saveViewed(identity.cache, identity.session, work, doc.kind, data);
      try {
        await preparePdfAssets();
        if (alive.current) setSavedMessage('');
      } catch {
        if (alive.current)
          setSavedMessage(
            'PDFは端末内に保存しました。オフライン表示用の準備が完了していません。通信に接続して、もう一度開いてください。',
          );
      }
    } catch {
      if (alive.current)
        setSavedMessage('この端末に保存できませんでした。オンラインでは引き続き閲覧できます。');
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
            setPending(true);
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
      {loaded && (
        <div className={styles.pdfHost} hidden={!data}>
          <Suspense fallback={<p role="status">PDFビューアを準備しています…</p>}>
            <PdfViewer blob={loaded.pdf.blob} visible={!!data} pageRequest={pageRequest} onReady={() => void onViewed()} />
          </Suspense>
        </div>
      )}
      {!data && <p role="status">PDFを取得しています…</p>}
      <div className={styles.readerNotice}>
        {historyError && (
          <p role="status">
            閲覧履歴を記録できませんでした。
            <button className="button secondary" onClick={() => void recordView()}>
              履歴の記録を再試行
            </button>
          </p>
        )}
        {savedMessage && <p role="status">{savedMessage}</p>}
      </div>
    </>
  );
}
