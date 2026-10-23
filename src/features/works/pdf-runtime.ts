import type EmbedPDF from '@embedpdf/snippet';
let pending: Promise<typeof EmbedPDF> | undefined;
export function loadViewer() {
  const runtime = globalThis as typeof globalThis & { TankyuEmbedPDF?: typeof EmbedPDF };
  if (runtime.TankyuEmbedPDF) return Promise.resolve(runtime.TankyuEmbedPDF);
  return (pending ??= new Promise<typeof EmbedPDF>((resolve, reject) => {
    // Module script preserves the SDK's own relative worker imports in dev and production.
    const script = document.createElement('script');
    script.type = 'module';
    script.src = '/embedpdf/2.15.1/bootstrap.js';
    script.onload = () => {
      script.remove();
      if (runtime.TankyuEmbedPDF) resolve(runtime.TankyuEmbedPDF);
      else reject(new Error('viewer_init'));
    };
    script.onerror = () => {
      script.remove();
      reject(new Error('viewer_load'));
    };
    document.head.append(script);
  }).catch((error: unknown) => {
    pending = undefined;
    throw error;
  }));
}
