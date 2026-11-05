import { useLayoutEffect } from 'react';
import { retainStartupScreen } from '../lib/startup-screen';
import '../styles/startup.css';

export function StartupScreen() {
  const shared = !!document.getElementById('app-startup');
  useLayoutEffect(() => {
    if (shared) return retainStartupScreen();
  }, [shared]);
  // The initial HTML and authentication use the same DOM node: no animation restart.
  if (shared) return null;
  return (
    <div className="startup-screen" role="status" aria-label="ログイン状態を確認中">
      <img src="/icons/loading.svg" alt="" width="104" height="104" />
      <p>探究アーカイブ</p>
    </div>
  );
}
