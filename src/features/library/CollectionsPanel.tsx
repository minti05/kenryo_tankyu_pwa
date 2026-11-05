import { useRef, useState, type FormEvent } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ArrowLeft, Bookmark, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { LoadMoreButton } from '../../components/LoadMoreButton';
import { LoadingSkeleton } from '../../components/Loading';
import { useAuth } from '../auth/context';
import { LiveWorkCard } from '../discovery/LiveWorkCard';
import type { SearchWorkDto } from '../../contracts/discovery.generated';
import { useCollections, useCollectionMutation, type Collection } from './collections';
import { libraryMessage } from './client';
import styles from './Collections.module.css';
export function CollectionsPanel() {
  const data = useCollections();
  const [selected, setSelected] = useState<string | null>(null),
    [editing, setEditing] = useState<Collection | 'new' | null>(null);
  const collection = data.data?.items.find((c) => c.id === selected);
  return (
    <section aria-label="コレクション一覧">
      {selected && (
        <button className={styles.back} onClick={() => setSelected(null)}>
          <ArrowLeft size={18} />
          すべてのコレクション
        </button>
      )}
      {!selected && (
        <div className={styles.heading}>
          <h2>コレクション</h2>
          <button className="button secondary" onClick={() => setEditing('new')}>
            <Plus size={18} />
            新規作成
          </button>
        </div>
      )}
      {data.isPending && <LoadingSkeleton label="コレクションを読み込み中" count={3} />}
      {data.isError && (
        <div role="alert">
          <p>{libraryMessage(data.error)}</p>
          <button className="button secondary" onClick={() => void data.refetch()}>
            読み直す
          </button>
        </div>
      )}
      {!selected && (
        <div className={styles.folders}>
          {data.data?.items.map((c) => (
            <div key={c.id} className={styles.folder}>
              <button className={styles.folderOpen} onClick={() => setSelected(c.id)}>
                <Bookmark size={24} />
                <span>
                  {c.name}
                  <small>{c.count}作品</small>
                </span>
              </button>
              <button
                className="icon-button"
                aria-label={`${c.name}のメニュー`}
                onClick={() => setEditing(c)}
              >
                <MoreHorizontal size={22} />
              </button>
            </div>
          ))}
        </div>
      )}
      {data.data && !data.data.items.length && (
        <p className="empty-state">
          まだコレクションはありません。作品のブックマークから保存できます。
        </p>
      )}
      {collection && (
        <>
          <div className={styles.heading}>
            <h2>{collection.name}</h2>
            <button
              className="icon-button"
              aria-label={`${collection.name}のメニュー`}
              onClick={() => setEditing(collection)}
            >
              <MoreHorizontal />
            </button>
          </div>
          <CollectionWorks key={collection.id} collection={collection} />
        </>
      )}
      {selected && data.data && !collection && (
        <p role="status">このコレクションは削除されました。</p>
      )}
      {editing && (
        <CollectionEditor
          collection={editing}
          onClose={() => setEditing(null)}
          onDeleted={() => {
            setEditing(null);
            setSelected(null);
          }}
        />
      )}
    </section>
  );
}
function CollectionEditor({
  collection,
  onClose,
  onDeleted,
}: {
  collection: Collection | 'new';
  onClose: () => void;
  onDeleted: () => void;
}) {
  const mutation = useCollectionMutation(),
    [name, setName] = useState(collection === 'new' ? '' : collection.name),
    [confirm, setConfirm] = useState(false);
  const id = useRef(crypto.randomUUID());
  async function save(event: FormEvent) {
    event.preventDefault();
    const created = collection === 'new';
    if (
      await mutation.mutate(
        created ? '/api/collections' : `/api/collections/${collection.id}`,
        created ? 'POST' : 'PUT',
        created
          ? { id: id.current, name: name.trim() }
          : { name: name.trim(), expectedRevision: collection.revision },
      )
    )
      onClose();
  }
  return (
    <Modal
      title={
        confirm
          ? 'コレクションを削除'
          : collection === 'new'
            ? 'コレクションを作成'
            : 'コレクションの編集'
      }
      onClose={() => {
        if (!mutation.busy) onClose();
      }}
    >
      {confirm && collection !== 'new' ? (
        <div className={styles.picker}>
          <p>
            「{collection.name}
            」を削除しますか？このコレクションの保存内容も削除されます。他のコレクションや作品、お気に入りは残ります。
          </p>
          <button
            className="button"
            disabled={mutation.busy}
            onClick={() =>
              void mutation
                .mutate(`/api/collections/${collection.id}`, 'DELETE', {
                  expectedRevision: collection.revision,
                })
                .then((ok) => {
                  if (ok) onDeleted();
                })
            }
          >
            削除する
          </button>
          <button
            className="button secondary"
            disabled={mutation.busy}
            onClick={() => setConfirm(false)}
          >
            キャンセル
          </button>
        </div>
      ) : (
        <form onSubmit={(e) => void save(e)} className={styles.createForm}>
          <label htmlFor="collection-name">コレクション名</label>
          <input
            id="collection-name"
            value={name}
            maxLength={80}
            required
            onChange={(e) => setName(e.target.value)}
            disabled={mutation.busy}
          />
          <button className="button" disabled={mutation.busy || !name.trim()}>
            {collection === 'new' ? '作成する' : '名前を保存'}
          </button>
          {collection !== 'new' && (
            <button
              className={styles.delete}
              type="button"
              disabled={mutation.busy}
              onClick={() => setConfirm(true)}
            >
              <Trash2 size={18} />
              コレクションを削除
            </button>
          )}
        </form>
      )}
      {mutation.message && <p role="alert">{mutation.message}</p>}
    </Modal>
  );
}
function CollectionWorks({ collection }: { collection: Collection }) {
  const { session, request, offline } = useAuth(),
    mutation = useCollectionMutation();
  const data = useInfiniteQuery({
    queryKey: ['collection-works', session?.uid, collection.id],
    enabled: !!session && !offline,
    initialPageParam: '',
    queryFn: ({ pageParam, signal }) =>
      request<{ items: SearchWorkDto[]; nextCursor: string | null }>(
        `/api/collections/${collection.id}/works${pageParam ? '?after=' + pageParam : ''}`,
        { signal },
      ),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });
  const items = [
    ...new Map(
      (data.data?.pages ?? []).flatMap((p) => p.items).map((w) => [w.documentID, w]),
    ).values(),
  ];
  return (
    <>
      {data.isPending && <LoadingSkeleton label="作品を読み込み中" cards count={4} />}
      {data.isError && (
        <div role="alert">
          <p>{libraryMessage(data.error)}</p>
          <button className="button secondary" onClick={() => void data.refetch()}>
            作品を読み直す
          </button>
        </div>
      )}
      <div className={styles.works}>
        {items.map((work) => (
          <LiveWorkCard
            key={work.documentID}
            work={work}
            from="/library"
            extraAction={
              <button
                className="icon-button"
                aria-label={`${work.title}をコレクションから外す`}
                disabled={mutation.busy}
                onClick={() =>
                  void mutation.mutate(
                    `/api/collections/${collection.id}/works/${work.documentID}`,
                    'PUT',
                    { saved: false },
                    work.documentID,
                  )
                }
              >
                <Trash2 size={17} />
              </button>
            }
          />
        ))}
      </div>
      {data.data && !items.length && (
        <p className="empty-state">
          保存された公開作品はありません。作品のブックマークから追加できます。
        </p>
      )}
      {mutation.message && <p role="alert">{mutation.message}</p>}
      {data.hasNextPage && (
        <LoadMoreButton
          loading={data.isFetchingNextPage}
          onClick={() => void data.fetchNextPage()}
        />
      )}
    </>
  );
}
