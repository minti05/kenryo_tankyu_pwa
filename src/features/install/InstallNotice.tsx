import { useSyncExternalStore } from 'react';
import { Check, Download, Share } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { useAuth } from '../auth/context';
import {
  detectInstallPlatform,
  closeInstallGuide,
  promptInstall,
  usePwaInstall,
} from '../../lib/pwa-install';
import { subscribeUpdates, updateSnapshot } from '../../lib/pwa-updates';
import './install.css';

export function InstallNotice() {
  const state = usePwaInstall();
  const { session } = useAuth();
  const updating = useSyncExternalStore(subscribeUpdates, updateSnapshot, () => false);
  const platform = detectInstallPlatform(navigator);
  const ios = platform.startsWith('ios-');
  const iphoneSafari = platform === 'ios-safari' && /iPhone|iPod/.test(navigator.userAgent);
  const modernSafari =
    iphoneSafari && Number(/Version\/(\d+)/.exec(navigator.userAgent)?.[1] ?? 0) >= 26;
  if (state.runningAsApp || updating || !state.guideOpen) return null;
  const completed = state.installed || state.accepted;
  return (
    <Modal
      title="アプリとしてインストール"
      onClose={closeInstallGuide}
      className={`install-guide ${iphoneSafari && !completed ? 'install-guide--iphone' : ''} ${modernSafari && !completed ? 'install-guide--menu' : ''}`}
    >
      {(completed || state.canPrompt) && (
        <div className="install-intro">
          <img src="/icons/app-icon.png" width="52" height="52" alt="" />
          <p>
            探究アーカイブをホーム画面に。
            <br />
            次からはアイコンをタップして開けます。
          </p>
        </div>
      )}
      {completed ? (
        <div className="install-complete" role="status">
          <Check size={24} aria-hidden="true" />
          <p>
            インストールを受け付けました。
            <br />
            ホーム画面やアプリ一覧の「探究アーカイブ」から開いてください。
          </p>
        </div>
      ) : state.canPrompt ? (
        <>
          <p>このブラウザからアプリをインストールできます。</p>
          <button
            className="button primary install-primary"
            disabled={state.busy}
            onClick={() => void promptInstall()}
          >
            <Download size={18} />
            {state.busy ? 'インストールを確認中…' : 'インストールする'}
          </button>
        </>
      ) : ios ? (
        <ol className="install-steps">
          <li>
            {platform === 'ios-safari' ? (
              <>
                <Share size={19} aria-hidden="true" /> Safariの「共有」をタップ
                {modernSafari ? '（画面下部の「…」メニュー内）' : ''}
              </>
            ) : platform === 'ios-chrome' ? (
              <>
                <Share size={19} aria-hidden="true" /> Chromeのアドレスバーにある「共有」をタップ
              </>
            ) : (
              'Safariでこのページを開き、「共有」をタップ'
            )}
          </li>
          <li>「ホーム画面に追加」を選ぶ</li>
          <li>「追加」をタップ</li>
        </ol>
      ) : platform === 'mac-safari' ? (
        <ol className="install-steps">
          <li>Safariの「ファイル」メニューを開く</li>
          <li>「Dockに追加」を選ぶ</li>
          <li>名前を確認して「追加」をクリック</li>
        </ol>
      ) : (
        <ol className="install-steps">
          <li>ブラウザのメニュー（⋮ または …）を開く</li>
          <li>
            {platform === 'android'
              ? '「アプリをインストール」または「ホーム画面に追加」を選ぶ'
              : '「探究アーカイブをインストール」または「このサイトをアプリとしてインストール」を選ぶ'}
          </li>
          <li>表示される案内に従って追加する</li>
        </ol>
      )}
      <p className="install-launch-note">
        追加したら、アプリを開いて、学校のGoogleアカウントでログインしてください。
      </p>
      {!completed && !state.canPrompt && (
        <details className="install-help">
          <summary>追加できないとき</summary>
          {ios ? (
            <>
              <p>
                共有ボタンの位置は表示設定によって異なります。見つからないときは「…」メニューを開いてください。
              </p>
              <p>
                「ホーム画面に追加」がない場合は、共有メニューの「アクションを編集」を確認してください。「Webアプリとして開く」が表示された場合はオンにしてください。
              </p>
              {platform !== 'ios-safari' && (
                <p>追加できない場合は、Safariでこのページを開いてお試しください。</p>
              )}
            </>
          ) : platform === 'mac-safari' ? (
            <p>
              macOS Sonoma
              14以降で利用できます。項目がない場合はSafariを更新するか、Chrome・Edgeでお試しください。
            </p>
          ) : (
            <p>
              項目名はブラウザによって異なります。項目がない場合は、Chrome・Edgeなどの対応ブラウザで開いてください。すでに追加済みの場合は、ホーム画面やアプリ一覧から開けます。
            </p>
          )}
        </details>
      )}
      {state.message && (
        <p role="status" className="install-note">
          {state.message}
        </p>
      )}
      <button className="install-later" onClick={closeInstallGuide}>
        {session ? '閉じる' : '使い方の選択に戻る'}
      </button>
    </Modal>
  );
}
