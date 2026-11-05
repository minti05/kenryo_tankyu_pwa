import type { ReactNode } from 'react';
import { FavoriteButton } from '../library/FavoriteButton';
import type { SearchWorkDto } from '../../contracts/discovery.generated';
import { WorkCardLayout } from './WorkCardLayout';
export function LiveWorkCard({
  work,
  from,
  showAwardDetails = false,
  extraAction,
}: {
  work: SearchWorkDto;
  from: string;
  showAwardDetails?: boolean;
  extraAction?: ReactNode;
}) {
  return (
    <WorkCardLayout
      work={work}
      to={`/works/${work.documentID}?from=${encodeURIComponent(from)}`}
      showAwardDetails={showAwardDetails}
      actions={
        work.isFavorite !== undefined || extraAction ? (
          <>
            {work.isFavorite !== undefined && <FavoriteButton work={work} showCount />}
            {extraAction}
          </>
        ) : null
      }
    />
  );
}
