/** Renders every design to tests/output/sheet/ for a human to look at. */
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'tests/output/sheet');
const SCENE = process.argv[2] || 'names';

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
page.on('console', (m) => { if (m.type() === 'error') console.log('  console:', m.text()); });
await page.goto(`http://127.0.0.1:${port}/dev-sheet.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__sheetReady === true, { timeout: 30000 });

await mkdir(OUT, { recursive: true });
const designs = await page.evaluate(() => window.designIds());
console.log(`Rendering ${designs.length} designs, scene "${SCENE}"`);

for (const d of designs) {
  const url = await page.evaluate(([id, scene]) => window.shot(id, scene), [d.id, SCENE]);
  await writeFile(resolve(OUT, `${d.id}.png`), Buffer.from(url.split(',')[1], 'base64'));
  console.log(`  ${d.id.padEnd(24)} ${d.categories.join(', ')}`);
}

await browser.close();
await server.close();
console.log(`\nWrote ${designs.length} stills to tests/output/sheet/`);
