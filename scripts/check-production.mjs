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
        text.includes('discovery-harness') ||
        text.includes('sample-work-') ||
        text.includes('雨の日の通学路')
      )
        throw new Error('Sample works leaked into production build');
    }
  console.log('Production build excludes sample works');
}
