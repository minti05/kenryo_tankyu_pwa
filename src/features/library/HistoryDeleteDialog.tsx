import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Modal } from '../../components/Modal';
import { LoadingIndicator } from '../../components/Loading';
import type { HistoryDeletedDto } from '../../contracts/library.generated';
import type { SearchWorkDto } from '../../contracts/discovery.generated';
import { useAuth } from '../auth/context';
import { cacheHistoryDelete } from './cache';
import { libraryMessage, retryableIntent } from './client';

export function HistoryDeleteDialog({
  work,
  onClose,
  onDeleted,
}: {
  work?: Pick<SearchWorkDto, 'documentID' | 'title'>;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { request, session, offline } = useAuth();
  const query = useQueryClient();
  const intent = useRef(retryableIntent());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function remove() {
    if (busy || offline || !session) return;
    const path = '/api/history' + (work ? '/' + work.documentID : '');
    const body = work ? {} : { scope: 'all' };
    setBusy(true);
    setError('');
    try {
      const result = await request<HistoryDeletedDto>(path, {
        method: 'DELETE',
        body: JSON.stringify({ ...body, ...intent.current({ path, body }) }),
      });
      await cacheHistoryDelete(query, session.uid, work?.documentID, body, result.stats);
      intent.current.clear();
      onDeleted();
    } catch (caught) {
      setError(libraryMessage(caught));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      variant="confirm"
      title={work ? 'この作品を削除しますか？' : '閲覧履歴を削除しますか？'}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      {work && (
        <p>
          <strong>{work.title}</strong>
        </p>
      )}
      <p>
        {work
          ? 'この作品の閲覧履歴とお気に入りを削除します。PDFのキャッシュは残ります。'
          : 'お気に入りとPDFのキャッシュは残ります。'}
      </p>
      {offline && <p role="status">閲覧履歴の削除はオンラインで利用できます。</p>}
      {error && <p role="alert">{error}</p>}
      <div className="confirm-modal-actions">
        <button disabled={busy} onClick={onClose}>
          キャンセル
        </button>
        <button disabled={busy || offline || !session} onClick={() => void remove()}>
          {busy ? <LoadingIndicator inline label="削除中" /> : '削除する'}
        </button>
      </div>
    </Modal>
  );
}
