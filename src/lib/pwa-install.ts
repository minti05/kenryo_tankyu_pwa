import { useSyncExternalStore } from 'react';

export type InstallPlatform =
  'ios-safari' | 'ios-chrome' | 'ios-other' | 'android' | 'mac-safari' | 'other';
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
export function detectInstallPlatform(
  nav: Pick<Navigator, 'userAgent' | 'platform' | 'maxTouchPoints'>,
): InstallPlatform {
  const ua = nav.userAgent;
  const ios =
    /iPhone|iPad|iPod/.test(ua) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
  if (ios) {
    if (/FBAN|FBAV|Instagram|Line\//.test(ua)) return 'ios-other';
    if (/CriOS\//.test(ua)) return 'ios-chrome';
    if (/Safari\//.test(ua) && !/FxiOS|EdgiOS|OPiOS|DuckDuckGo|GSA\//.test(ua)) return 'ios-safari';
    return 'ios-other';
  }
  if (/Android/.test(ua)) return 'android';
  if (/Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome|Chromium|Edg|OPR/.test(ua))
    return 'mac-safari';
  return 'other';
}

const modes = ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay'].map((mode) =>
  matchMedia(`(display-mode: ${mode})`),
);
function appMode() {
  return (
    modes.some((mode) => mode.matches) ||
    !!(navigator as Navigator & { standalone?: boolean }).standalone
  );
}
let promptEvent: InstallPromptEvent | null = null;
let installedThisPage = false;
const initiallyRunningAsApp = appMode();
let snapshot = {
  installed: initiallyRunningAsApp,
  runningAsApp: initiallyRunningAsApp,
  accepted: false,
  canPrompt: false,
  guideOpen: false,
  busy: false,
  message: '',
};
const listeners = new Set<() => void>();
function update(change: Partial<typeof snapshot>) {
  snapshot = { ...snapshot, ...change };
  listeners.forEach((listener) => listener());
}
// Imported by the application shell, before authentication or lazy account screens load.
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  if (snapshot.installed) return;
  promptEvent = event as InstallPromptEvent;
  update({ canPrompt: true, message: '' });
});
window.addEventListener('appinstalled', () => {
  installedThisPage = true;
  promptEvent = null;
  update({ installed: true, accepted: true, canPrompt: false, busy: false });
});
function syncDisplayMode() {
  const runningAsApp = appMode();
  update({
    installed: installedThisPage || runningAsApp,
    runningAsApp,
    ...(runningAsApp ? { guideOpen: false } : {}),
  });
}
modes.forEach((mode) => mode.addEventListener('change', syncDisplayMode));
window.addEventListener('pageshow', syncDisplayMode);
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function usePwaInstall() {
  return useSyncExternalStore(subscribe, () => snapshot);
}
export function closeInstallGuide() {
  update({ guideOpen: false });
}
export function openInstallGuide() {
  if (!snapshot.runningAsApp) update({ guideOpen: true, message: '' });
}
export async function promptInstall() {
  if (!promptEvent || snapshot.busy) return;
  const event = promptEvent;
  promptEvent = null; // Each event can only be used once.
  update({ busy: true, message: '' });
  try {
    // Keep this call in the click's user activation; do not await other work first.
    await event.prompt();
    const choice = await event.userChoice;
    if (!snapshot.installed) {
      if (choice.outcome === 'accepted') {
        update({ accepted: true });
      } else {
        update({ message: 'インストールを見送りました。設定画面からまた確認できます。' });
      }
    }
  } catch {
    update({
      message: 'インストール画面を開けませんでした。ブラウザのメニューから追加してください。',
    });
  } finally {
    update({ busy: false, canPrompt: promptEvent !== null });
  }
}
