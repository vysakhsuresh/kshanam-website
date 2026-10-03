import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const page = (name) => resolve(here, 'app', name);

// The app lives in app/ so the entry pages sit together, and the build output
// goes to dist/, which is what Cloudflare Pages publishes.
// GitHub Pages serves the repo under /kshanam-website/; Cloudflare Pages
// serves it at the root. One build, one environment variable.
const base = process.env.KSHANAM_BASE || '/';

export default defineConfig({
  base,
  root: 'app',
  publicDir: 'public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    target: 'es2022',
    rollupOptions: {
      // Every page has to be listed: Vite builds index.html and nothing else
      // by default, so a new page silently goes missing from dist/.
      // dev-render.html is deliberately absent - it is the test harness and
      // has no business being deployed.
      input: {
        home: page('index.html'),
        details: page('details.html'),
        guest: page('guest.html'),
      },
    },
  },
  server: { host: '127.0.0.1' },
});
