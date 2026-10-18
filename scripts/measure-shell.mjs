// Production shell only. No test auth, cloud credentials, or production workload.
import { chromium, webkit } from '@playwright/test';
import { spawn } from 'node:child_process';
const origin = 'http://127.0.0.1:4183';
const server = spawn(
  process.execPath,
  [
    'node_modules/vite/bin/vite.js',
    'preview',
    '--host',
    '127.0.0.1',
    '--port',
    '4183',
    '--strictPort',
  ],
  { stdio: 'ignore' },
);
const report = {
  scope: 'localhost-production-welcome-shell',
  limitations: [
    'No school device, cloud latency, authenticated search or PDF',
    'Chromium mobile CPU/network simulation is synthetic; WebKit is unthrottled',
    'Two cold-cache samples per viewport do not establish production p95',
  ],
  samples: [],
};
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    if (server.exitCode !== null) throw Error('preview_exited');
    try {
      if ((await fetch(origin, { signal: AbortSignal.timeout(300) })).ok) {
        ready = true;
        break;
      }
    } catch {
      // Preview is still starting; retry within the bounded readiness loop.
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  if (!ready) throw Error('preview_not_ready');
  for (const [engine, type] of [
    ['chromium', chromium],
    ['webkit', webkit],
  ]) {
    const browser = await type.launch();
    try {
      for (const [device, width, height] of [
        ['phone', 390, 844],
        ['tablet', 820, 1180],
        ['desktop', 1440, 1000],
      ])
        for (let n = 0; n < 2; n++) {
          const context = await browser.newContext({
            viewport: { width, height },
            reducedMotion: 'reduce',
          });
          try {
            const page = await context.newPage();
            // Fail if a measurement attempts a remote request.
            await page.route('**/*', (route) =>
              new URL(route.request().url()).origin === origin ? route.continue() : route.abort(),
            );
            const simulated = engine === 'chromium' && device === 'phone';
            if (simulated) {
              const cdp = await context.newCDPSession(page);
              await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
              await cdp.send('Network.enable');
              await cdp.send('Network.emulateNetworkConditions', {
                offline: false,
                latency: 150,
                downloadThroughput: 1_600_000 / 8,
                uploadThroughput: 750_000 / 8,
              });
            }
            const start = performance.now();
            await page.goto(origin + '/welcome');
            await page.getByRole('heading', { level: 1 }).waitFor();
            await page.evaluate(() => document.fonts.ready);
            const result = await page.evaluate(() => ({
              domMs:
                performance.getEntriesByType('navigation')[0]?.domContentLoadedEventEnd ?? null,
              fcpMs: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null,
              loadedResourceBytes: performance
                .getEntriesByType('resource')
                .reduce((s, r) => s + r.encodedBodySize, 0),
              overflow: document.documentElement.scrollWidth > innerWidth + 1,
            }));
            report.samples.push({
              engine,
              device,
              viewport: { width, height },
              simulatedPhone: simulated,
              sample: n + 1,
              headingReadyMs: Math.round(performance.now() - start),
              ...result,
            });
          } finally {
            await context.close();
          }
        }
    } finally {
      await browser.close();
    }
  }
  console.log(JSON.stringify(report, null, 2));
  if (report.samples.some((s) => s.overflow)) process.exitCode = 2;
} finally {
  server.kill('SIGTERM');
  await new Promise((r) => (server.exitCode !== null ? r() : server.once('exit', r)));
}
