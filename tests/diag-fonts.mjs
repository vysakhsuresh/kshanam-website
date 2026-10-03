/** Finds which step of worker font loading never returns. Not part of the suite. */
import { createServer } from 'vite';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const server = await createServer({
  root: resolve(ROOT, 'app'),
  configFile: resolve(ROOT, 'vite.config.js'),
  server: { port: 0, host: '127.0.0.1', hmr: false, watch: null },
  logLevel: 'warn',
});
await server.listen();
const port = server.config.server.port || server.httpServer.address().port;

const { chromium } = await import('playwright');
let browser;
try { browser = await chromium.launch(); }
catch { browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); }

const page = await browser.newPage();
page.on('pageerror', (e) => console.log('  page error:', String(e)));
await page.goto(`http://127.0.0.1:${port}/diag.html`, { waitUntil: 'load' });

const rows = await page.evaluate(() => new Promise((resolve, reject) => {
  const w = new Worker(new URL('./diag-fonts-worker.js', location.href), { type: 'module' });
  w.onmessage = (e) => { resolve(e.data); w.terminate(); };
  w.onerror = (e) => reject(new Error(e.message || 'worker failed to start'));
  setTimeout(() => reject(new Error('worker never replied at all')), 60000);
  w.postMessage({ baseUrl: '/' });
}));

for (const r of rows) {
  console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${String(r.name).padEnd(38)} ${r.ms}ms ${r.error || ''}`);
}

await browser.close();
await server.close();
