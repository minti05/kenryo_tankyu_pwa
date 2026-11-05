import { RelatedWorks } from './RelatedWorks';
import { Link } from 'react-router-dom';
import { ArrowRight, Layers3, Sparkles } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { CATEGORY_CATALOG } from '../../contracts/catalog.generated';
import type { SearchWorkDto } from '../../contracts/discovery.generated';
import { useAuth } from '../auth/context';
import styles from './SimilarWorks.module.css';
export function SimilarWorksDialog({
  work,
  onClose,
}: {
  work: SearchWorkDto;
  onClose: () => void;
}) {
  const { offline } = useAuth();
  const categories = (
    [
      [work.category1, work.subCategory1],
      [work.category2, work.subCategory2],
    ] as const
  )
    .filter(([id]) => id !== 'none')
    .map(([id, subId]) => {
      const category = CATEGORY_CATALOG.find((c) => c.id === id);
      const sub = category?.subcategories.find((s) => s.id === subId);
      return { id, subId, label: sub?.label ?? category?.label ?? 'その他' };
    });
  return (
    <Modal title="似た探究作品" onClose={onClose}>
      <div className={styles.source}>
        <Layers3 size={18} />
        <span>{work.title}</span>
      </div>
      <RelatedWorks id={work.documentID} onNavigate={onClose} />
      {!offline && (
        <>
          <div className={styles.categories}>
            <p>同じカテゴリから探す</p>
            {categories.map((c, index) => (
              <Link
                key={index}
                onClick={onClose}
                to={`/results?${new URLSearchParams({ category: c.id, ...(c.subId !== 'none' ? { subcategory: c.subId } : {}) })}`}
              >
                <span>{c.label}</span>
                <ArrowRight size={17} />
              </Link>
            ))}
          </div>
          <Link
            className={styles.chat}
            onClick={onClose}
            to={`/search/chat?${new URLSearchParams({ q: `「${work.title.slice(0, 120)}」のような探究を探したい` })}`}
          >
            <Sparkles size={17} />
            言葉から探してみる
            <ArrowRight size={17} />
          </Link>
        </>
      )}
    </Modal>
  );
}
