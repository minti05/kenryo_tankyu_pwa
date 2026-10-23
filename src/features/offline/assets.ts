let pending: Promise<void> | undefined;
export function preparePdfAssets(options: { background?: boolean } = {}) {
  return (pending ??= (async () => {
    if (!('serviceWorker' in navigator)) throw new Error('offline_viewer_unavailable');
    const registration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('offline_viewer_unavailable')), 5000),
      ),
    ]);
    const worker = registration.active;
    if (!worker) throw new Error('offline_viewer_unavailable');
    await new Promise<void>((resolve, reject) => {
      const channel = new MessageChannel();
      const timer = setTimeout(() => {
        channel.port1.close();
        reject(new Error('offline_viewer_timeout'));
      }, 90000);
      channel.port1.onmessage = (event) => {
        clearTimeout(timer);
        channel.port1.close();
        if (event.data?.ok) resolve();
        else reject(new Error('offline_viewer_unavailable'));
      };
      worker.postMessage({ type: 'PREPARE_PDF_ASSETS', background: options.background === true }, [
        channel.port2,
      ]);
    });
  })().finally(() => {
    pending = undefined;
  }));
}
