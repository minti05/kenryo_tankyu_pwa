import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const base = new URL('../src/contracts/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', base), 'utf8'));
for (const [name, expected] of Object.entries(manifest.files)) {
  const content = await readFile(new URL(name, base), 'utf8');
  if (createHash('sha256').update(content).digest('hex') !== expected)
    throw new Error('Generated contract changed: ' + name);
  if (/from\s*['"].*(shared|controller)/.test(content))
    throw new Error('Private contract dependency');
}
console.log('Public contract ' + manifest.version + ' verified');
