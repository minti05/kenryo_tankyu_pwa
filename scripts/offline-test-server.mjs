// An isolated fixture-auth build. Never writes dist/ and never deploys.
import { spawn } from 'node:child_process';
const node = process.execPath;
async function run(args, env = process.env) {
  const c = spawn(node, args, { stdio: 'inherit', env });
  if ((await new Promise((r) => c.once('exit', r))) !== 0)
    throw new Error('offline test build failed');
}
await run(['scripts/check-offline-isolation.mjs']);
await run(['scripts/copy-pdf-assets.mjs']);
await run(['node_modules/vite/bin/vite.js', 'build', '--outDir', '.cache/offline-build'], {
  ...process.env,
  TANKYU_OFFLINE_TEST_BUILD: '1',
});
const c = spawn(
  node,
  [
    'node_modules/vite/bin/vite.js',
    'preview',
    '--outDir',
    '.cache/offline-build',
    '--host',
    '127.0.0.1',
    '--port',
    '4178',
    '--strictPort',
  ],
  { stdio: 'inherit', env: { ...process.env, TANKYU_OFFLINE_TEST_BUILD: '1' } },
);
for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(signal, () => {
    c.kill(signal);
  });
await new Promise((r) => c.once('exit', r));
