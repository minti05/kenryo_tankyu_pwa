/* This page is deliberately outside the app-shell cache and needs no app bundle. */
const button = document.getElementById('repair');
const status = document.getElementById('status');
const waitInstalled = worker => new Promise((resolve, reject) => {
  const timer = setTimeout(() => done(new Error('timeout')), 45000);
  const check = () => {
    if (['installed', 'activated'].includes(worker.state)) done();
    else if (worker.state === 'redundant') done(new Error('replaced'));
  };
  const done = error => { clearTimeout(timer); worker.removeEventListener('statechange', check); if (error) reject(error); else resolve(); };
  worker.addEventListener('statechange', check); check();
});
button.addEventListener('click', async () => {
  button.disabled = true;
  status.textContent = 'アプリを確認しています…';
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
    await reg.update();
    if (reg.installing) await waitInstalled(reg.installing);
    const worker = reg.waiting || reg.active;
    if (!worker) throw new Error('unavailable');
    await new Promise((resolve, reject) => {
      const channel = new MessageChannel();
      const timer = setTimeout(() => { channel.port1.close(); reject(new Error('timeout')); }, 45000);
      channel.port1.onmessage = event => {
        clearTimeout(timer); channel.port1.close();
        if (event.data?.ok) resolve(); else reject(new Error('repair_failed'));
      };
      worker.postMessage({ type: 'REPAIR_SHELL' }, [channel.port2]);
    });
    if (reg.waiting) await new Promise((resolve, reject) => {
      const timer = setTimeout(() => done(new Error('timeout')), 30000);
      const check = () => { if (worker.state === 'activated') done(); else if (worker.state === 'redundant') done(new Error('replaced')); };
      const done = error => { clearTimeout(timer); worker.removeEventListener('statechange', check); if (error) reject(error); else resolve(); };
      worker.addEventListener('statechange', check);
      worker.postMessage({ type: 'SKIP_WAITING' }); check();
    });
    location.replace('/welcome');
  } catch {
    status.textContent = '修復できませんでした。通信を確認して、もう一度お試しください。';
    button.disabled = false;
  }
});
