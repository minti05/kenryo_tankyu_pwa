import { Link } from 'react-router-dom';
import { ArrowUpRight, Bookmark } from 'lucide-react';
import type { WorkDto } from '../../contracts/work.generated';
import { CategoryArt } from '../../components/CategoryArt';
import { categoryLabel, documentTypes, DOCUMENT_LABELS } from './search';
import { usePreviewLibrary } from '../library/PreviewLibrary';
import styles from './WorkCard.module.css';
export function WorkCard({ work, from = '' }: { work: WorkDto; from?: string }) {
  const { saved, toggle } = usePreviewLibrary(),
    isSaved = saved.has(work.documentID),
    link = `/preview/works/${work.documentID}${from ? `?from=${encodeURIComponent(from)}` : ''}`;
  return (
    <article className={styles.card}>
      <Link
        to={link}
        className={styles.cover}
        data-category={work.category1}
        aria-label={`${work.title}の詳細`}
      >
        <span className={styles.category}>{categoryLabel(work.category1)}</span>
        <CategoryArt category={work.category1} className={styles.art} />
        <span className={styles.coverTitle}>{work.title}</span>
        <span className={styles.coverBottom}>
          KENRYO INQUIRY
          <ArrowUpRight size={18} />
        </span>
      </Link>
      <div className={styles.info}>
        <div className={styles.meta}>
          <span>{work.enterYear}年度入学</span>
          <span>
            {documentTypes(work)
              .map((kind) => DOCUMENT_LABELS[kind])
              .join('・')}
          </span>
        </div>
        <h3>
          <Link to={link}>{work.title}</Link>
        </h3>
        <div className={styles.bottom}>
          <span>{work.author}</span>
          <button
            className={isSaved ? styles.saved : styles.save}
            onClick={() => toggle(work.documentID)}
            aria-label={`${work.title}を${isSaved ? 'ライブラリから外す' : 'ライブラリに保存'}`}
            aria-pressed={isSaved}
          >
            <Bookmark size={18} fill={isSaved ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>
    </article>
  );
}
