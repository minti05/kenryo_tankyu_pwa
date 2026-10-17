import { ApiError } from '../../lib/api-client';
export interface PdfData {
  blob: Blob;
  sha256: string;
  revision: string;
  authorizedAt: string;
  receivedMono: number;
}
export async function readPdfResponse(
  response: Response,
  expected: { bytes: number; revision: string; startedMono?: number },
): Promise<PdfData> {
  const receivedMono = expected.startedMono ?? performance.now();
  if (
    response.headers.get('Content-Type')?.split(';')[0] !== 'application/pdf' ||
    response.headers.get('X-Document-Revision') !== expected.revision ||
    Number(response.headers.get('Content-Length')) !== expected.bytes ||
    expected.bytes < 5 ||
    expected.bytes > 3_000_000
  )
    throw new ApiError(422, 'invalid_document');
  const sha256 = response.headers.get('X-Content-SHA256') ?? '',
    authorizedAt = response.headers.get('X-Authorized-At') ?? '';
  if (
    !/^[a-f0-9]{64}$/.test(sha256) ||
    !Number.isFinite(Date.parse(authorizedAt)) ||
    !response.body
  )
    throw new ApiError(422, 'invalid_document');
  const reader = response.body.getReader(),
    chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > expected.bytes) {
        await reader.cancel();
        throw new ApiError(422, 'invalid_document');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (size !== expected.bytes) throw new ApiError(422, 'invalid_document');
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    bytes.set(c, at);
    at += c.length;
  }
  const actual = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  if (actual !== sha256 || new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-')
    throw new ApiError(422, 'document_hash_mismatch');
  return {
    blob: new Blob([bytes], { type: 'application/pdf' }),
    sha256,
    revision: expected.revision,
    authorizedAt,
    receivedMono,
  };
}
export function safePdfName(id: string, kind: string, title: string) {
  const clean = Array.from(title.normalize('NFKC'))
    .map((c) => {
      const n = c.codePointAt(0)!;
      return n < 32 || n === 127 ? '_' : c;
    })
    .join('')
    .replace(/[/\\:*?"<>|]/g, '_')
    .replace(/[\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/^\.+/, '')
    .trim()
    .slice(0, 60);
  return `${clean || '探究作品'}-${id}-${kind}.pdf`;
}
