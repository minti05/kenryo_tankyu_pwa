import { useState } from 'react';
import { localReadingTips } from '../lib/reading-tips';
import styles from './PdfLoading.module.css';

export function PdfLoading() {
  const [tip] = useState(() => {
    const tips = localReadingTips();
    return tips[Math.floor(Math.random() * tips.length)];
  });
  return (
    <div className={styles.overlay} role="status" aria-label="PDFを読み込み中" data-pdf-loading>
      <img src="/icons/loading-loop.svg" width="104" height="104" alt="" aria-hidden="true" />
      <span className="sr-only">PDFを読み込み中</span>
      {tip && (
        <p className={styles.tip}>
          <span>探究のヒント</span>
          {tip}
        </p>
      )}
    </div>
  );
}
