import { FavoriteButton } from '../library/FavoriteButton';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import type { SearchWorkDto } from '../../contracts/discovery.generated';
import { CategoryArt } from '../../components/CategoryArt';
import { categoryLabel, documentTypes, DOCUMENT_LABELS } from './search';
import styles from './WorkCard.module.css';
export function LiveWorkCard({ work, from }: { work: SearchWorkDto; from: string }) {
  const link = `/works/${work.documentID}?from=${encodeURIComponent(from)}`;
  return (
    <article className={styles.card}>
      <Link
        to={link}
        className={styles.cover}
        data-category={work.category1}
        aria-label={`${work.title}の詳細`}
      >
        <span className={styles.category}>
          {[work.category1, work.category2]
            .filter((c) => c !== 'none')
            .map((c) => categoryLabel(c))
            .join(' / ')}
        </span>
        <CategoryArt
          secondaryCategory={work.category2}
          category={work.category1}
          className={styles.art}
        />
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
              .map((t) => DOCUMENT_LABELS[t])
              .join('・')}
          </span>
        </div>
        <h3>
          <Link to={link}>{work.title}</Link>
        </h3>
        <div className={styles.bottom}>
          <span>{work.author}</span>
          {work.awardType && <span>KRGP受賞</span>}
          {work.isFavorite !== undefined && <FavoriteButton work={work} showCount />}
        </div>
      </div>
    </article>
  );
}
