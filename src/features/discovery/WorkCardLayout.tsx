import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { WorkDto } from '../../contracts/work.generated';
import { WorkArt } from '../../components/WorkArt';
import { workCategoryLabels } from './search';
import { AWARDS } from './filter-options';
import styles from './WorkCard.module.css';

type CardWork = Omit<WorkDto, 'likes'>;
export function WorkCardLayout({
  work,
  to,
  actions,
  showAwardDetails = false,
}: {
  work: CardWork;
  to: string;
  actions: ReactNode;
  showAwardDetails?: boolean;
}) {
  const category = workCategoryLabels(work).join(' ／ ');
  const education = `${work.enterYear}年度入学・${work.course === 'tankyu' ? '探究科' : '普通科'}`;
  return (
    <article className={styles.card} data-has-action={!!actions}>
      <div className={styles.cover} data-category={work.category1} aria-hidden="true">
        {work.category2 && work.category2 !== 'none' && work.category2 !== work.category1 && (
          <span className={styles.secondaryBackground} data-category-background={work.category2} />
        )}
        <WorkArt
          category={work.category1}
          subcategory={work.subCategory1}
          secondaryCategory={work.category2}
          secondarySubcategory={work.subCategory2}
          className={styles.art}
        />
      </div>
      <div className={styles.info}>
        <div className={styles.category} title={category}>
          {category}
        </div>
        <h3>
          <Link
            to={to}
            className={styles.titleLink}
            aria-label={`${work.title}の詳細`}
            title={work.title}
          >
            {work.title}
          </Link>
        </h3>
        <div
          className={styles.meta}
          title={`${education}・${work.author}${work.awardType ? '・KRGP受賞' : ''}`}
        >
          <span>
            {education}・{work.author}
          </span>
          {work.awardType && !showAwardDetails && <span className={styles.award}>・KRGP受賞</span>}
        </div>
        {showAwardDetails && work.awardType && (
          <div className={styles.awardLabels}>
            <span data-prize={work.awardType}>
              {AWARDS.find(([id]) => id === String(work.awardType))?.[1]}
            </span>
            {work.awardName && <span>{work.awardName}</span>}
          </div>
        )}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </article>
  );
}
