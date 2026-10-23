// Only public SDK code/fonts go here. Student documents remain in the protected cache.
import { readFile, mkdir, cp, rm, readdir, writeFile } from 'node:fs/promises';
import ts from 'typescript';
const version = '2.15.1';
for (const name of ['snippet', 'pdfium', 'react-pdf-viewer']) {
  const pkg = JSON.parse(await readFile(`node_modules/@embedpdf/${name}/package.json`, 'utf8'));
  if (pkg.version !== version) throw new Error('Review EmbedPDF assets before changing versions');
}
await rm('public/pdfjs', { recursive: true, force: true });
await rm('public/embedpdf', { recursive: true, force: true });
const root = `public/embedpdf/${version}`;
await mkdir(`${root}/fonts`, { recursive: true });
for (const name of await readdir('node_modules/@embedpdf/snippet/dist'))
  if (name.endsWith('.js'))
    await cp(`node_modules/@embedpdf/snippet/dist/${name}`, `${root}/${name}`);
await cp('node_modules/@embedpdf/pdfium/dist/pdfium.wasm', `${root}/pdfium.wasm`);
for (const [pkg, files] of [
  ['jp', ['NotoSansJP-Regular.otf', 'NotoSansJP-Bold.otf']],
  [
    'latin',
    ['NotoSans-Regular.ttf', 'NotoSans-Bold.ttf', 'NotoSans-Italic.ttf', 'NotoSans-BoldItalic.ttf'],
  ],
]) {
  for (const file of files)
    await cp(`node_modules/@embedpdf/fonts-${pkg}/fonts/${file}`, `${root}/fonts/${file}`);
  const source = `node_modules/@embedpdf/fonts-${pkg}`;
  for (const file of await readdir(source))
    if (/license|ofl/i.test(file)) await cp(`${source}/${file}`, `${root}/fonts/${pkg}-${file}`);
}
await cp('node_modules/@embedpdf/pdfium/LICENSE.pdfium', `${root}/PDFium-LICENSE`);
for (const name of ['snippet', 'pdfium'])
  await cp(`node_modules/@embedpdf/${name}/LICENSE`, `${root}/${name}-LICENSE`);

await writeFile(
  `${root}/bootstrap.js`,
  `import EmbedPDF from './embedpdf.js';\nglobalThis.TankyuEmbedPDF = EmbedPDF;\n`,
);

// Publish the SDK's two inline worker programs as same-origin files. This also avoids
// retaining their Blob URLs after SDK teardown (upstream 2.15.1 does not revoke them).
const workerBundle = (await readdir(root)).find((name) => /^worker-engine-.*\.js$/.test(name));
const path = `${root}/${workerBundle}`;
const source = await readFile(path, 'utf8');
const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const replacements = [];
function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(ast) === 'URL.createObjectURL') {
    const blob = node.arguments[0];
    if (!blob || !ts.isNewExpression(blob) || blob.expression.getText(ast) !== 'Blob')
      throw new Error('worker_asset_shape');
    const parts = blob.arguments?.[0];
    if (
      !parts ||
      !ts.isArrayLiteralExpression(parts) ||
      parts.elements.length !== 1 ||
      !ts.isStringLiteral(parts.elements[0])
    )
      throw new Error('worker_asset_shape');
    const name = replacements.length === 0 ? 'pdfium-worker.js' : 'image-encoder-worker.js';
    replacements.push({
      start: node.getStart(ast),
      end: node.end,
      name,
      code: parts.elements[0].text,
    });
  }
  ts.forEachChild(node, visit);
}
visit(ast);
if (replacements.length !== 2) throw new Error('Review changed SDK worker layout');
let output = source;
for (const item of replacements.reverse()) {
  await writeFile(`${root}/${item.name}`, item.code);
  output =
    output.slice(0, item.start) +
    `new URL('./${item.name}', import.meta.url).href` +
    output.slice(item.end);
}
await writeFile(path, output);

// Upstream's async engine hook can finish after unmount. Dispose that late engine
// instead of assigning it to an already-disconnected viewer. Keep this pinned and
// fail the build if the upstream implementation changes.
const main = (await readdir(root)).find((name) => /^embedpdf-.*\.js$/.test(name));
const mainPath = `${root}/${main}`;
const mainCode = await readFile(mainPath, 'utf8');
const hook =
  /const\{createPdfiumEngine:e\}=n\?await import\("(\.\/worker-engine-[^"]+\.js)"\):await import\("(\.\/direct-engine-[^"]+\.js)"\),a=await e\(t,\{logger:o,encoderPoolSize:i,fontFallback:r\}\);h\.current=a,s\(a\),c\(!1\)/g;
if ([...mainCode.matchAll(hook)].length !== 1)
  throw new Error('Review changed SDK engine lifecycle');
await writeFile(
  mainPath,
  mainCode.replace(
    hook,
    (_, worker, direct) =>
      `const{createPdfiumEngine:__tankyuCreateEngine}=n?await import("${worker}"):await import("${direct}"),a=await __tankyuCreateEngine(t,{logger:o,encoderPoolSize:i,fontFallback:r});if(e){a.destroy();return}h.current=a,s(a),c(!1)`,
  ),
);
