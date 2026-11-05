import { ChevronRight, Download } from 'lucide-react';
import { openInstallGuide, usePwaInstall } from '../../lib/pwa-install';
export function InstallSetting() {
  const { runningAsApp } = usePwaInstall();
  if (runningAsApp) return null;
  return (
    <section className="settings-group" aria-label="アプリのインストール">
      <button
        className="setting-row setting-action"
        onClick={(event) => {
          event.currentTarget.focus();
          openInstallGuide();
        }}
      >
        <Download size={21} />
        <div className="setting-copy">
          <span>アプリとしてインストール</span>
          <small>ホーム画面から、探究アーカイブを起動</small>
        </div>
        <ChevronRight size={18} />
      </button>
    </section>
  );
}
