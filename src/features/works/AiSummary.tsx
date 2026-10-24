import { useId, useState } from 'react';
import { ArrowUpRight, ScanText, Sparkles } from 'lucide-react';
import type { WorkSummaryDto, WorkSummaryEvidenceDto } from '../../contracts/documents.generated';
import { DOCUMENT_LABELS } from '../discovery/search';
import styles from './AiSummary.module.css';

export function AiSummary({
  summary,
  onReference,
}: {
  summary: WorkSummaryDto;
  onReference: (reference: WorkSummaryEvidenceDto) => void;
}) {
  const [references, setReferences] = useState(false);
  const bodyId = useId();
  const spans = summary.evidence
    .flatMap((e) => e.targets.map((t) => ({ ...t, reference: e })))
    .sort((a, b) => a.start - b.start);
  let cursor = 0;
  const parts = [];
  for (const span of spans) {
    // Reject malformed/overlapping offsets defensively; body remains plain text.
    if (
      !Number.isInteger(span.start) ||
      !Number.isInteger(span.end) ||
      span.start < cursor ||
      span.end <= span.start ||
      span.end > summary.body.length
    )
      continue;
    parts.push(summary.body.slice(cursor, span.start));
    parts.push(
      <button
        key={span.start}
        className={styles.reference}
        title={`${DOCUMENT_LABELS[span.reference.kind]} · ${span.reference.page}ページを開く`}
        onClick={() => onReference(span.reference)}
      >
        {summary.body.slice(span.start, span.end)}
      </button>,
    );
    cursor = span.end;
  }
  parts.push(summary.body.slice(cursor));
  return (
    <section className={styles.summary} aria-label="AI要約">
      <div className={styles.heading}>
        <h2>
          <Sparkles size={16} aria-hidden="true" />
          AI要約
        </h2>
        {!!spans.length && (
          <button
            className={styles.toggle}
            aria-pressed={references}
            aria-controls={bodyId}
            onClick={() => setReferences(!references)}
          >
            <ScanText size={15} aria-hidden="true" />
            {references ? '根拠を閉じる' : '根拠を確認'}
          </button>
        )}
      </div>
      <p id={bodyId} className={styles.body}>
        {references ? parts : summary.body}
      </p>
      {references && (
        <p className={styles.hint}>
          <ArrowUpRight size={14} aria-hidden="true" />
          下線から資料の該当ページへ
        </p>
      )}
      <p className={styles.note}>AIが作成した要約です。詳しい内容は資料で確認できます。</p>
    </section>
  );
}
