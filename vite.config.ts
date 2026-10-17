import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';
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
      react(),
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src/sw',
        filename: 'sw.ts',
        registerType: 'prompt',
        injectRegister: null,
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
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
