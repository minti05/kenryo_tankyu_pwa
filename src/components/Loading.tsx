import styles from './Loading.module.css';

export function LoadingIndicator({
  label = '読み込み中',
  inline = false,
  className = '',
}: {
  label?: string;
  inline?: boolean;
  className?: string | undefined;
}) {
  return (
    <span
      className={`${inline ? styles.inline : styles.indicator} ${className}`}
      role="status"
      aria-label={label}
    >
      <span className={styles.spinner} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function LoadingSkeleton({
  label,
  cards = false,
  count = 3,
  className = '',
}: {
  label: string;
  cards?: boolean;
  count?: number;
  className?: string | undefined;
}) {
  return (
    <div role="status" aria-label={label}>
      <span className="sr-only">{label}</span>
      <div className={`${styles.skeletons} ${className}`} aria-hidden="true">
        {Array.from({ length: count }, (_, index) => (
          <div key={index} className={cards ? styles.card : styles.row}>
            {cards && <div className={`${styles.bone} ${styles.cover}`} />}
            <div className={styles.lines}>
              <div className={`${styles.bone} ${styles.short}`} />
              <div className={styles.bone} />
              <div className={`${styles.bone} ${styles.medium}`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
