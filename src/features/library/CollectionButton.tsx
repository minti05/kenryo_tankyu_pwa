import { useRef, useState, type FormEvent } from 'react';
import { Bookmark, Plus } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { useAuth } from '../auth/context';
import { useCollections, useCollectionMutation } from './collections';
import { libraryMessage } from './client';
import styles from './Collections.module.css';
export function CollectionButton({ documentID }: { documentID: string }) {
  const { offline } = useAuth(),
    data = useCollections(documentID);
  const [open, setOpen] = useState(false);
  const saved = data.data?.items.some((c) => c.saved) ?? false;
  return (
    <>
      <button
        className="work-icon-button"
        aria-label="コレクションに保存"
        title="コレクションに保存"
        aria-pressed={saved}
        disabled={offline}
        onClick={() => setOpen(true)}
      >
        <Bookmark size={23} strokeWidth={1.7} fill={saved ? 'currentColor' : 'none'} />
      </button>
      {open && <CollectionPicker documentID={documentID} onClose={() => setOpen(false)} />}
    </>
  );
}
function CollectionPicker({ documentID, onClose }: { documentID: string; onClose: () => void }) {
  const data = useCollections(documentID),
    mutation = useCollectionMutation();
  const [name, setName] = useState('');
  const [pending, setPending] = useState<{ id: string; saved: boolean } | null>(null);
  const newID = useRef(crypto.randomUUID());
  async function create(event: FormEvent) {
    event.preventDefault();
    if (
      await mutation.mutate(
        '/api/collections',
        'POST',
        { id: newID.current, name: name.trim(), documentID },
        documentID,
      )
    ) {
      setName('');
      newID.current = crypto.randomUUID();
    }
  }
  return (
    <Modal
      title="コレクションに保存"
      onClose={() => {
        if (!mutation.busy) onClose();
      }}
    >
      <div className={styles.picker}>
        <p className={styles.hint}>
          保存先を選んでください。複数のコレクションに保存できます。変更はすぐに保存されます。
        </p>
        {data.isPending && <p role="status">コレクションを読み込み中…</p>}
        {data.isError && (
          <div role="alert">
            <p>{libraryMessage(data.error)}</p>
            <button className="button secondary" onClick={() => void data.refetch()}>
              読み直す
            </button>
          </div>
        )}
        {data.data && (
          <>
            <div className={styles.choices}>
              {data.data.items.map((c) => (
                <label key={c.id} className={styles.choice}>
                  <input
                    type="checkbox"
                    checked={pending?.id === c.id ? pending.saved : (c.saved ?? false)}
                    disabled={mutation.busy}
                    onChange={(e) => {
                      const saved = e.target.checked;
                      setPending({ id: c.id, saved });
                      void mutation
                        .mutate(
                          `/api/collections/${c.id}/works/${documentID}`,
                          'PUT',
                          { saved },
                          documentID,
                        )
                        .finally(() => setPending(null));
                    }}
                  />
                  <span>
                    {c.name}
                    <small>{c.count}作品</small>
                  </span>
                </label>
              ))}
            </div>
            {!data.data.items.length && (
              <p>まだコレクションがありません。名前を付けて最初の保存先を作りましょう。</p>
            )}
            <form onSubmit={(e) => void create(e)} className={styles.createForm}>
              <label htmlFor="new-collection">新しいコレクション</label>
              <input
                id="new-collection"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例：研究のヒント"
                maxLength={80}
                required
                disabled={mutation.busy}
              />
              <button className="button secondary" disabled={mutation.busy || !name.trim()}>
                <Plus size={18} />
                作成して保存
              </button>
            </form>
          </>
        )}
        {mutation.message && <p role="alert">{mutation.message}</p>}
        <button className="button" disabled={mutation.busy} onClick={onClose}>
          完了
        </button>
      </div>
    </Modal>
  );
}
