import { offlineApi } from './tests/offline-api.mjs';
import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig(({ command, mode }) => {
  const sample =
    command === 'serve' || loadEnv(mode, process.cwd(), 'VITE_').VITE_ENABLE_PREVIEW === 'true';
  return {
    resolve: {
      alias: {
        '@preview-routes': fileURLToPath(
          new URL(
            sample
              ? './src/features/discovery/PreviewRoutes.tsx'
              : './src/features/discovery/DisabledPreview.tsx',
            import.meta.url,
          ),
        ),
      },
    },
    plugins: [
      ...(process.env.TANKYU_OFFLINE_TEST_BUILD === '1' ? [offlineApi()] : []),
      ...(process.env.TANKYU_OFFLINE_TEST_BUILD === '1'
        ? [
            {
              name: 'offline-test-auth-only',
              enforce: 'pre' as const,
              configResolved(config: import('vite').ResolvedConfig) {
                if (config.build.outDir !== '.cache/offline-build')
                  throw new Error('Fixture auth is restricted to .cache/offline-build');
              },
              resolveId(source: string, importer: string | undefined) {
                if (importer?.endsWith('/features/notifications/runtime.ts')) {
                  if (source === 'firebase/messaging')
                    return fileURLToPath(new URL('./tests/offline-messaging.ts', import.meta.url));
                  if (source === '../../lib/firebase-config')
                    return fileURLToPath(
                      new URL('./tests/offline-push-config.ts', import.meta.url),
                    );
                }
                if (importer?.endsWith('/src/sw/sw.ts') && source === './notifications')
                  return fileURLToPath(
                    new URL('./tests/offline-notification-sw.ts', import.meta.url),
                  );
                if (
                  importer?.endsWith('/features/auth/AuthProvider.tsx') &&
                  source === './firebase'
                )
                  return fileURLToPath(new URL('./tests/offline-firebase.ts', import.meta.url));
              },
            },
          ]
        : []),
      {
        name: 'pdf-offline-manifest',
        writeBundle(options, bundle) {
          if (!Object.keys(bundle).some((name) => /^assets\/pdf-runtime-/.test(name))) return;
          const files: { url: string; size: number; sha256: string }[] = [];
          const add = (url: string, bytes: Uint8Array | string) =>
            files.push({
              url,
              size: Buffer.byteLength(bytes),
              sha256: createHash('sha256').update(bytes).digest('hex'),
            });
          for (const name of Object.keys(bundle))
            if (/^assets\/(pdf-runtime-|pdf\.worker)/.test(name))
              add('/' + name, readFileSync(join(options.dir!, name)));
          function walk(dir: string) {
            for (const entry of readdirSync(dir, { withFileTypes: true })) {
              const path = join(dir, entry.name);
              if (entry.isDirectory()) walk(path);
              else add('/' + path.replace(/^public\//, ''), readFileSync(path));
            }
          }
          walk('public/embedpdf/2.15.1');
          writeFileSync(
            join(options.dir!, 'pdf-offline-manifest.json'),
            JSON.stringify({ version: '1', files }),
          );
        },
      },
      react(),
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src/sw',
        filename: 'sw.ts',
        registerType: 'prompt',
        injectRegister: null,
        injectManifest: {
          buildPlugins: {
            vite:
              process.env.TANKYU_OFFLINE_TEST_BUILD === '1'
                ? [
                    {
                      name: 'offline-push-sw-sink',
                      enforce: 'pre',
                      resolveId(source: string, importer: string | undefined) {
                        if (importer?.endsWith('/src/sw/sw.ts') && source === './notifications')
                          return fileURLToPath(
                            new URL('./tests/offline-notification-sw.ts', import.meta.url),
                          );
                      },
                    },
                  ]
                : [],
          },
          globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
          globIgnores: ['**/pdf-runtime-*.js', '**/pdf.worker*', 'pdfjs/**', 'embedpdf/**'],
          maximumFileSizeToCacheInBytes: 2000000,
        },
        manifest: {
          name: '探究アーカイブ',
          short_name: '探究アーカイブ',
          description: '松本県ケ丘高校生徒のための探究アーカイブ',
          lang: 'ja',
          start_url: '/welcome',
          scope: '/',
          display: 'standalone',
          background_color: '#f7f5f0',
          theme_color: '#8f123f',
          icons: [
            { src: '/icons/app-icon.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          ],
        },
        devOptions: { enabled: false },
      }),
    ],
    server: { proxy: { '/api': 'http://127.0.0.1:8787' } },
    build: { target: ['es2022', 'safari16.4'], sourcemap: false },
  };
});
