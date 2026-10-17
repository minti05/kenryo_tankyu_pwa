// SDK assets only. No student PDFs or credentials belong in public/.
import { readFile, mkdir, cp, rm } from 'node:fs/promises';
const { version } = JSON.parse(await readFile('node_modules/pdfjs-dist/package.json', 'utf8'));
if (version !== '6.4.299') throw new Error('Review PDF.js asset/version changes before building');
const root = `public/pdfjs/${version}`;
await rm('public/pdfjs', { recursive: true, force: true });
await mkdir(root, { recursive: true });
for (const folder of ['cmaps', 'standard_fonts', 'wasm', 'iccs'])
  await cp(`node_modules/pdfjs-dist/${folder}`, `${root}/${folder}`, { recursive: true });
await cp('node_modules/pdfjs-dist/LICENSE', `${root}/LICENSE`);
