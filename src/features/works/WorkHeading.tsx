import './work-actions.css';
import { useDesktopReader } from './reader-layout';
import { useState, useContext } from 'react';
import { createPortal } from 'react-dom';
import { WorkHeaderTarget } from './header-context';
import { Modal } from '../../components/Modal';
import { WorkMenu } from './WorkMenu';
import { DownloadDialog } from './DownloadDialog';
import { WorkActions } from '../library/WorkActions';
import type { WorkDocumentDto } from '../../contracts/documents.generated';
import { FavoriteButton } from '../library/FavoriteButton';
import type { SearchWorkDto } from '../../contracts/discovery.generated';
import styles from './WorkPage.module.css';
export function WorkHeading({
  work,
  kind,
  documents = [],
}: {
  work: SearchWorkDto;
  kind?: string | undefined;
  documents?: WorkDocumentDto[];
}) {
  const [shareStatus, setShareStatus] = useState(''),
    [manualCopy, setManualCopy] = useState(''),
    [modal, setModal] = useState<'download' | 'report' | null>(null);
  const headerTarget = useContext(WorkHeaderTarget);
  const desktop = useDesktopReader();
  const target = desktop ? null : headerTarget;
  const id = work.documentID;
  async function share() {
    setShareStatus('');
    setManualCopy('');
    const url = new URL('/works/' + id, location.origin);
    if (kind) url.searchParams.set('kind', kind);
    const mobileOrTablet =
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ||
      (navigator.maxTouchPoints > 0 && matchMedia('(pointer: coarse)').matches);
    if (mobileOrTablet && navigator.share) {
      try {
        await navigator.share({ title: work.title, url: url.href });
        setShareStatus('共有しました。');
        return;
      } catch (e) {
        if (e && typeof e === 'object' && 'name' in e && e.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url.href);
      setShareStatus('作品のリンクをコピーしました。リンク先でも学校のログインが必要です。');
    } catch {
      setManualCopy(url.href);
      setShareStatus('下のリンクを選択してコピーしてください。');
    }
  }
  const actions = (
    <div className="work-heading-actions">
      <FavoriteButton work={work} showCount />
      <WorkMenu
        expandedActions={desktop}
        onShare={() => void share()}
        onDownload={() => setModal('download')}
        onReport={() => setModal('report')}
      />
    </div>
  );
  const feedback = (shareStatus || manualCopy) && (
    <div className="work-share-feedback">
      {shareStatus && <p role="status">{shareStatus}</p>}
      {manualCopy && (
        <input
          className={styles.shareLink}
          aria-label="共有する作品のリンク"
          readOnly
          value={manualCopy}
          onFocus={(e) => e.target.select()}
        />
      )}
    </div>
  );
  return (
    <>
      {target &&
        createPortal(
          <div className="work-toolbar-content">
            {actions}
            {feedback}
          </div>,
          target,
        )}
      {modal === 'download' && (
        <DownloadDialog
          work={work}
          documents={documents}
          kind={kind}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'report' && (
        <Modal title="作品情報を報告" onClose={() => setModal(null)}>
          <WorkActions work={work} />
        </Modal>
      )}
      <header className={styles.intro}>
        <div className={styles.titleRow}>
          <h1>{work.title}</h1>
        </div>
        {!target && (
          <div className={styles.sideActions}>
            {actions}
            {feedback}
          </div>
        )}
      </header>
    </>
  );
}
