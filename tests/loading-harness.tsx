import { createRoot } from 'react-dom/client';
import { StrictMode, useEffect, useState } from 'react';
import { StartupScreen } from '../src/components/StartupScreen';
import { StartupHandoff } from '../src/components/StartupHandoff';
import { PdfLoading } from '../src/components/PdfLoading';
import { syncReadingTips } from '../src/lib/reading-tips';
import '../src/styles/global.css';
function Harness() {
  const [pending, setPending] = useState(true);
  const [pdf, setPdf] = useState(false);
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    Object.assign(window, { finishStartup: () => setPending(false) });
  }, []);
  return (
    <StartupHandoff>
      {pending && <StartupScreen />}
      <button onClick={() => setPending(true)}>起動表示を再表示</button>
      <button
        onClick={() => {
          setPdf(true);
          setCycle((n) => n + 1);
        }}
      >
        PDF待機を表示
      </button>
      <button onClick={() => setPdf(false)}>PDF表示完了</button>
      <button
        onClick={() => {
          void syncReadingTips(
            async <T,>(path: string, options?: RequestInit) =>
              (await fetch(path, options)).json() as Promise<T>,
          );
        }}
      >
        ヒントを同期
      </button>
      <div style={{ position: 'relative', height: 500 }}>{pdf && <PdfLoading key={cycle} />}</div>
    </StartupHandoff>
  );
}
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Harness />
  </StrictMode>,
);
