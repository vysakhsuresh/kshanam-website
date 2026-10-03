/** Isolates where the encode pipeline stalls. Not part of the suite. */
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
page.on('console', (m) => { if (m.type() === 'error') console.log('  console error:', m.text()); });
page.on('pageerror', (e) => console.log('  page error:', String(e)));

await page.goto(`http://127.0.0.1:${port}/diag.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__diagReady === true, { timeout: 30000 });

const results = await page.evaluate(() => window.diag());
for (const r of results) {
  console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.case}`);
  console.log(`      ${r.ok ? `${r.bytes} bytes, ${r.video}/${r.audio || 'none'}` : r.error}  (${r.ms}ms)`);
}

await browser.close();
await server.close();
