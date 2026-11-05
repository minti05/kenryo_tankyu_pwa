import { Bookmark } from 'lucide-react';
import type { WorkDto } from '../../contracts/work.generated';
import { usePreviewLibrary } from '../library/PreviewLibrary';
import { WorkCardLayout } from './WorkCardLayout';
import styles from './WorkCard.module.css';
export function WorkCard({ work, from = '' }: { work: WorkDto; from?: string }) {
  const { saved, toggle } = usePreviewLibrary();
  const isSaved = saved.has(work.documentID);
  return (
    <WorkCardLayout
      work={work}
      to={`/preview/works/${work.documentID}${from ? `?from=${encodeURIComponent(from)}` : ''}`}
      actions={
        <button
          className={isSaved ? styles.saved : styles.save}
          onClick={() => toggle(work.documentID)}
          aria-label={`${work.title}を${isSaved ? 'ライブラリから外す' : 'ライブラリに保存'}`}
          aria-pressed={isSaved}
        >
          <Bookmark size={18} fill={isSaved ? 'currentColor' : 'none'} />
        </button>
      }
    />
  );
}
