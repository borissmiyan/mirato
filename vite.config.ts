import fs from 'fs';
import os from 'os';
import path from 'path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

import electron from 'vite-plugin-electron/simple'

/** Dev-only middleware that streams the generated 385-hymn .mrt archive from ~/Documents without bloating public/ or dist/. */
function devFullHymnsPlugin(): Plugin {
  return {
    name: 'dev-full-hymns-mrt',
    configureServer(server) {
      server.middlewares.use('/__dev-hymns-full.mrt', (_req, res, next) => {
        const mrtPath = path.join(os.homedir(), 'Documents', 'Гимны Надежды (1-385)', 'Гимны Надежды (1-385).mrt');
        if (!fs.existsSync(mrtPath)) return next();
        const stat = fs.statSync(mrtPath);
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Length', String(stat.size));
        fs.createReadStream(mrtPath).pipe(res);
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    appType: 'mpa',
    server: {
      port: 3210,
      host: '0.0.0.0',
    },
    plugins: [
      devFullHymnsPlugin(),
      react(),
      tailwindcss(),
      electron({
        main: {
          // Shortcut of `build.lib.entry`.
          entry: 'electron/main.ts',
          vite: {
            build: {
              rollupOptions: {
                external: ['bufferutil', 'utf-8-validate']
              }
            }
          }
        },
        preload: {
          // Shortcut of `build.rollupOptions.input`.
          // Preload scripts may contain Web assets, so use the `build.rollupOptions.input` instead `build.lib.entry`.
          input: 'electron/preload.ts',
          vite: {
            build: {
              rollupOptions: {
                output: {
                  format: 'cjs',
                  entryFileNames: '[name].cjs',
                },
              },
            },
          },
        },
        // Ployfill the Electron and Node.js built-in modules for Renderer process.
        // See 👉 https://github.com/electron-vite/vite-plugin-electron-renderer
        renderer: {},
      }),
    ],
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          projector: path.resolve(__dirname, 'projector.html'),
          remote: path.resolve(__dirname, 'remote.html'),
          stage: path.resolve(__dirname, 'stage.html'),
        },
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('lucide-react')) {
                return 'vendor-icons';
              }
              if (id.includes('@ffmpeg') || id.includes('jszip')) {
                return 'vendor-media';
              }
              if (id.includes('i18next')) {
                return 'vendor-i18n';
              }
              if (id.includes('react') || id.includes('jotai') || id.includes('zustand') || id.includes('dexie')) {
                return 'vendor-core';
              }
            }
          },
        },
      },
    },
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      }
    },
    // @ts-ignore
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.tsx'],
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      coverage: {
        reporter: ['text', 'json', 'html'],
        exclude: ['node_modules/', 'src/test/setup.tsx'],
      },
    },
  };
});
