import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
// 実作品は扱わない。通常buildに架空のプレビュー作品を残さない。
if (process.env.VITE_ENABLE_PREVIEW === 'true') {
  console.log('Explicit sample preview build. Not a live archive.');
} else {
  for (const file of await readdir('dist/assets'))
    if (file.endsWith('.js')) {
      const text = await readFile(join('dist/assets', file), 'utf8');
      if (
        text.includes('fixture-token') ||
        text.includes('FIXTURE_PUSH') ||
        text.includes('/api/acceptance/test') ||
        text.includes('fixture-push-token') ||
        text.includes('offline-fixture-user') ||
        text.includes('offlineFixtureStore') ||
        text.includes('discovery-harness') ||
        text.includes('sample-work-') ||
        text.includes('雨の日の通学路')
      )
        throw new Error('Sample works leaked into production build');
    }
  console.log('Production build excludes sample works');
}

const sw = await readFile('dist/sw.js', 'utf8');
if (/FIXTURE_PUSH|fixture-push-token/.test(sw))
  throw new Error('Notification fixture leaked into production SW');
if (
  [...sw.matchAll(/url:["']([^"']+)["']/g)].some((m) =>
    /pdf-runtime-|pdf\.worker|pdfjs\/|embedpdf\//.test(m[1]),
  )
)
  throw new Error('Heavy PDF engine must not be precached on Welcome');
