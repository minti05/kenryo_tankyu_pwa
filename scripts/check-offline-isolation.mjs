import { spawnSync } from 'node:child_process';
const result = spawnSync(
  process.execPath,
  ['node_modules/vite/bin/vite.js', 'build', '--outDir', '.cache/forbidden-fixture'],
  { encoding: 'utf8', env: { ...process.env, TANKYU_OFFLINE_TEST_BUILD: '1' } },
);
if (result.status === 0 || !(result.stderr + result.stdout).includes('Fixture auth is restricted'))
  throw new Error('Offline fixture output restriction failed');
console.log('Fixture authentication is rejected outside the isolated test directory');
