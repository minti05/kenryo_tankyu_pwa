import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
import worker from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
GlobalWorkerOptions.workerSrc = worker;
export async function loadPdf(data: Uint8Array) {
  return getDocument({
    data,
    cMapUrl: '/pdfjs/6.4.299/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: '/pdfjs/6.4.299/standard_fonts/',
    wasmUrl: '/pdfjs/6.4.299/wasm/',
    iccUrl: '/pdfjs/6.4.299/iccs/',
    enableXfa: false,
    stopAtErrors: true,
    canvasMaxAreaInBytes: 16 * 1024 * 1024,
  });
}
