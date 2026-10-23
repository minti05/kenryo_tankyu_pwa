import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Download, ShieldCheck } from 'lucide-react';
import { Modal } from '../../components/Modal';
import type { SearchWorkDto } from '../../contracts/discovery.generated';
import type { WorkDocumentDto } from '../../contracts/documents.generated';
import { useAuth } from '../auth/context';
import { readSaved, usable, type CachedPdf } from '../offline/store';
import { DOCUMENT_LABELS } from '../discovery/search';
import { ApiError } from '../../lib/api-client';
import { readPdfResponse, safePdfName } from './pdf-data';
interface ReadyDownload {
  url: string;
  name: string;
  at: number;
  files: WorkDocumentDto[];
  saved: CachedPdf[];
}
export function DownloadDialog({
  work,
  documents,
  kind,
  onClose,
}: {
  work: SearchWorkDto;
  documents: WorkDocumentDto[];
  kind?: string | undefined;
  onClose: () => void;
}) {
  const { requestResponse, offline, cacheSession } = useAuth();
  const [selected, setSelected] = useState<string[]>(() => {
    const first =
      documents.find((d) => d.kind === kind && d.state === 'available') ||
      documents.find((d) => d.state === 'available');
    return first ? [first.kind] : [];
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [ready, setReady] = useState<ReadyDownload | null>(null);
  const alive = useRef(true),
    abort = useRef(new AbortController()),
    artifact = useRef<ReadyDownload | null>(null);
  function clear() {
    if (artifact.current) URL.revokeObjectURL(artifact.current.url);
    artifact.current = null;
    setReady(null);
  }
  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    abort.current = controller;
    return () => {
      alive.current = false;
      controller.abort();
      if (artifact.current) URL.revokeObjectURL(artifact.current.url);
    };
  }, []);
  useEffect(() => {
    if (!offline || !ready) return;
    const check = () => {
      if (!cacheSession || ready.saved.some((row) => !usable(cacheSession, row))) {
        URL.revokeObjectURL(ready.url);
        artifact.current = null;
        setReady(null);
        setError(
          '保存期限が切れたか、ログイン状態が変更されました。通信に接続して作品を開き直してください。',
        );
      }
    };
    const timer = setInterval(check, 1000);
    return () => clearInterval(timer);
  }, [offline, ready, cacheSession]);
  async function authorize(doc: WorkDocumentDto) {
    const response = await requestResponse(
      `/api/works/${work.documentID}/pdf/${doc.kind}?revision=${doc.revision}`,
      { method: 'HEAD', signal: abort.current.signal, headers: { Accept: 'application/pdf' } },
    );
    if (
      response.headers.get('Content-Type')?.split(';')[0] !== 'application/pdf' ||
      response.headers.get('X-Document-Revision') !== doc.revision ||
      Number(response.headers.get('Content-Length')) !== doc.bytes ||
      !Number.isFinite(Date.parse(response.headers.get('X-Authorized-At') || '')) ||
      !/^[a-f0-9]{64}$/.test(response.headers.get('X-Content-SHA256') || '') ||
      (doc.sha256 && response.headers.get('X-Content-SHA256') !== doc.sha256)
    )
      throw new ApiError(409, 'document_changed');
    return response.headers.get('X-Content-SHA256')!;
  }
  async function prepare() {
    if (busy || !selected.length) return;
    clear();
    setBusy(true);
    setError('');
    try {
      const chosen = documents.filter((d) => selected.includes(d.kind) && d.state === 'available');
      if (!chosen.length || chosen.length !== selected.length || chosen.length > 4)
        throw new Error('selection_changed');
      const files: Record<string, Uint8Array> = {},
        saved: CachedPdf[] = [];
      for (const doc of chosen) {
        if (!doc.revision || !doc.bytes || doc.bytes > 3_000_000)
          throw new Error('invalid_document');
        const expectedHash = offline ? doc.sha256 : await authorize(doc);
        const cached = cacheSession
          ? await readSaved(cacheSession, work.documentID, doc.kind, doc.revision).catch(() => null)
          : null;
        let blob: Blob;
        if (offline) {
          if (!cached || !cacheSession || !usable(cacheSession, cached)) throw new Error('expired');
          saved.push(cached);
          blob = cached.blob;
        } else if (cached && cached.bytes === doc.bytes && cached.sha256 === expectedHash)
          blob = cached.blob;
        else {
          const response = await requestResponse(
            `/api/works/${work.documentID}/pdf/${doc.kind}?revision=${doc.revision}`,
            { signal: abort.current.signal, headers: { Accept: 'application/pdf' } },
          );
          const pdf = await readPdfResponse(response, { bytes: doc.bytes, revision: doc.revision });
          if (expectedHash && pdf.sha256 !== expectedHash)
            throw new ApiError(409, 'document_changed');
          blob = pdf.blob;
        }
        files[safePdfName(work.documentID, doc.kind, work.title)] = new Uint8Array(
          await blob.arrayBuffer(),
        );
      }
      const names = Object.keys(files);
      let blob: Blob, name: string;
      if (names.length === 1) {
        name = names[0]!;
        blob = new Blob([files[name]!.slice().buffer], { type: 'application/pdf' });
      } else {
        const { zipSync } = await import('fflate');
        blob = new Blob([zipSync(files, { level: 0 }).slice().buffer], { type: 'application/zip' });
        name = safePdfName(work.documentID, '資料', work.title).replace(/\.pdf$/, '.zip');
      }
      if (!alive.current || abort.current.signal.aborted) return;
      if (offline && (!cacheSession || saved.some((row) => !usable(cacheSession, row))))
        throw new Error('expired');
      const result = {
        url: URL.createObjectURL(blob),
        name,
        at: performance.now(),
        files: chosen,
        saved,
      };
      artifact.current = result;
      setReady(result);
    } catch (e) {
      if (alive.current && !abort.current.signal.aborted)
        setError(
          e instanceof ApiError && e.code === 'document_changed'
            ? '資料が更新されました。作品を開き直して、もう一度お試しください。'
            : offline
              ? '保存した資料の期限やログイン状態を確認できませんでした。通信に接続して作品を開き直してください。'
              : '資料を読み込めませんでした。通信を確認してお試しください。',
        );
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  function download(event: MouseEvent<HTMLAnchorElement>) {
    if (!ready) return;
    if (offline) {
      if (!cacheSession || ready.saved.some((row) => !usable(cacheSession, row))) {
        event.preventDefault();
        clear();
        setError('保存期限が切れました。通信に接続して確認してください。');
      }
    } else if (performance.now() - ready.at > 5000 || performance.now() < ready.at) {
      event.preventDefault();
      void prepare();
    }
  }
  return (
    <Modal title="PDFダウンロード" onClose={onClose}>
      <div className="download-guidance">
        <ShieldCheck size={23} />
        <div>
          <p>自分の学習・研究のためだけに使用してください。</p>
          <p>SNSやWebサイトへのアップロード、他の人への再配布はしないでください。</p>
        </div>
      </div>
      <p className="download-note">
        端末へダウンロードした資料は自動では削除されません。学校の利用規約を守ってご利用ください。
      </p>
      <fieldset className="download-choices" disabled={busy}>
        <legend>ダウンロードする資料</legend>
        {documents.map((doc) => (
          <label key={doc.kind}>
            <input
              type="checkbox"
              checked={selected.includes(doc.kind)}
              disabled={doc.state !== 'available'}
              onChange={(e) => {
                clear();
                setError('');
                setSelected((previous) =>
                  e.target.checked
                    ? [...previous, doc.kind]
                    : previous.filter((k) => k !== doc.kind),
                );
              }}
            />
            <span>{DOCUMENT_LABELS[doc.kind]}</span>
            {doc.state !== 'available' && <small>現在ダウンロードできません</small>}
          </label>
        ))}
      </fieldset>
      {!documents.some((d) => d.state === 'available') && (
        <p role="status">
          {offline
            ? 'この端末に保存した資料がありません。'
            : '現在ダウンロードできる資料がありません。'}
        </p>
      )}
      <p className="download-note">複数選ぶと、1つのZIPファイルにまとめて保存できます。</p>
      {error && <p role="alert">{error}</p>}
      {ready ? (
        <>
          <p role="status">ダウンロードできます。</p>
          <a
            className="button primary download-save"
            href={ready.url}
            download={ready.name}
            target="_blank"
            rel="noopener noreferrer"
            onClick={download}
          >
            <Download size={18} />
            {ready.files.length > 1 ? 'ZIPを端末に保存' : 'PDFを端末に保存'}
          </a>
          <p className="download-note">
            保存先を選べない場合は、開いた画面の共有メニューから「ファイルに保存」を選んでください。
          </p>
        </>
      ) : (
        <button
          className="button primary download-save"
          disabled={busy || !selected.length}
          onClick={() => void prepare()}
        >
          {busy ? '資料を確認しています…' : '同意して進む'}
        </button>
      )}
    </Modal>
  );
}
