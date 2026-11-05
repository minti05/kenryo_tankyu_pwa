import { MoreHorizontal } from 'lucide-react';
import { LoadingIndicator } from './Loading';
import styles from './LoadMoreButton.module.css';

export function LoadMoreButton({
  onClick,
  loading = false,
  label = 'さらに表示',
  loadingLabel = '追加の作品を読み込み中',
}: {
  onClick: () => void;
  loading?: boolean;
  label?: string;
  loadingLabel?: string;
}) {
  return (
    <button
      className={styles.button}
      aria-label={label}
      title={label}
      disabled={loading}
      onClick={onClick}
    >
      {loading ? (
        <LoadingIndicator inline label={loadingLabel} />
      ) : (
        <MoreHorizontal size={24} aria-hidden="true" />
      )}
    </button>
  );
}
