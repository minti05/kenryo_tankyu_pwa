import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { getManifest } from 'workbox-build';
const fixed = resolve('dist');
const old = fixed;
// Reproduce the former worker's navigation logic without depending on saved release artifacts.
const { manifestEntries } = await getManifest({
  globDirectory: fixed,
  globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
  globIgnores: [
    '**/pdf-runtime-*.js',
    '**/pdf.worker*',
    'pdfjs/**',
    'embedpdf/**',
    'assets/recover.html',
    'assets/recover.js',
  ],
  maximumFileSizeToCacheInBytes: 2000000,
});
const legacyBuild = await build({
  stdin: {
    contents: `import{precacheAndRoute,cleanupOutdatedCaches,createHandlerBoundToURL}from'workbox-precaching';import{NavigationRoute,registerRoute}from'workbox-routing';precacheAndRoute(${JSON.stringify(manifestEntries)});cleanupOutdatedCaches();registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'),{denylist:[/^\\/api(?:\\/|$)/,/^\\/assets(?:\\/|$)/]}));self.addEventListener('message',e=>{if(e.data?.type==='SKIP_WAITING')self.skipWaiting()});`,
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  minify: true,
  format: 'iife',
  define: { 'process.env.NODE_ENV': '"production"' },
});
const legacySw = legacyBuild.outputFiles[0].text;
const index = await readFile(fixed + '/index.html', 'utf8');
const index2 = index.replace('</head>', '<meta name="test-release" content="2"></head>');
const sw = await readFile(fixed + '/sw.js', 'utf8');
const md5 = (text) => createHash('md5').update(text).digest('hex');
const integrity = (text) => 'sha256-' + createHash('sha256').update(text).digest('base64');
if (!sw.includes(md5(index)) || !sw.includes(integrity(index)))
  throw Error('manifest_hash_not_found');
const sw2 = sw.replaceAll(md5(index), md5(index2)).replaceAll(integrity(index), integrity(index2));
const broken = /src="(\/assets\/[^" ]+\.js)"/.exec(index)[1];
let state = { release: 'old', broken: false, denyOld: false };
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
};
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1:4179');
    if (url.pathname === '/__test__/release') {
      if (req.method === 'POST') {
        let b = '';
        for await (const c of req) b += c;
        state = { ...state, ...JSON.parse(b) };
      }
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(state));
      return;
    }
    if (url.pathname === '/index.html') {
      res.writeHead(308, { Location: '/' + url.search, 'Cache-Control': 'no-store' });
      res.end();
      return;
    }
    if (url.pathname.startsWith('/api/')) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end('{"error":"session_required"}');
      return;
    }
    let bytes;
    const directory = state.release === 'old' ? old : fixed;
    if (url.pathname === '/sw.js')
      bytes = state.release === 'old' ? legacySw : state.release === 'fixed2' ? sw2 : sw;
    else if (state.broken && url.pathname === broken) bytes = '<html>Incomplete deployment</html>';
    else if (url.pathname.startsWith('/assets/recover.'))
      bytes = await readFile(fixed + url.pathname);
    else if (url.pathname === '/' || !extname(url.pathname))
      bytes = state.release === 'fixed2' ? index2 : await readFile(directory + '/index.html');
    else {
      const path = resolve(directory, '.' + url.pathname);
      if (!path.startsWith(directory + '/')) throw Error('path');
      try {
        bytes = await readFile(path);
      } catch {
        if (state.denyOld) throw Error('not_found');
        bytes = await readFile(old + url.pathname);
      }
    }
    res.writeHead(200, {
      'Content-Type':
        state.broken && url.pathname === broken
          ? 'text/html'
          : types[extname(url.pathname)] || 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Service-Worker-Allowed': '/',
    });
    res.end(bytes);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
  }
}).listen(4179, '127.0.0.1', () => console.log('PWA update regression server ready'));
