import { spawn } from 'node:child_process';
const env = {
  ...process.env,
  VITE_FIREBASE_API_KEY: 'fixture-web-key',
  VITE_FIREBASE_AUTH_DOMAIN: 'demo-tankyu-auth.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'demo-tankyu-auth',
  VITE_ENABLE_PREVIEW: 'false',
};
async function run(path, args) {
  const child = spawn(process.execPath, [path, ...args], { env, stdio: 'inherit' });
  const code = await new Promise((resolve) => child.once('exit', resolve));
  if (code !== 0) throw new Error('Authentication fixture check failed');
}
await run('node_modules/vite/bin/vite.js', ['build', '--outDir', '.cache/auth-build']);
await run('node_modules/@playwright/test/cli.js', [
  'test',
  '--config',
  'playwright.auth.config.ts',
]);
