/**
 * Checks the built site the way GitHub Pages will serve it.
 *
 * The dev server hides a whole class of mistake: an absolute path that works
 * at the root and 404s under /kshanam-website/, a worker that only resolves
 * because Vite was transforming modules on the fly. This serves dist/ from a
 * sub-path with a plain static server and drives it, including making a real
 * video with the bundled worker.
 *
 *   KSHANAM_BASE=/kshanam-website/ npm run build
 *   node tests/built-site.mjs [--base /kshanam-website/]
 */
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argBase = process.argv.indexOf('--base');
const BASE = (argBase > -1 ? process.argv[argBase + 1] : '/kshanam-website/');

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.txt': 'text/plain', '.mp4': 'video/mp4',
};

const results = [];
const ok = (label, condition, detail = '') => {
  results.push({ label, pass: !!condition });
  console.log(`  ${condition ? 'ok  ' : 'FAIL'} ${label}${detail ? `  (${detail})` : ''}`);
};

async function main() {
  const dist = resolve(ROOT, 'dist');
  if (!existsSync(dist)) {
    console.error('No dist/. Run: KSHANAM_BASE=/kshanam-website/ npm run build');
    process.exit(1);
  }

  // Lay the build out under the sub-path, exactly as Pages will.
  const servedRoot = await mkdtemp(join(tmpdir(), 'kshanam-pages-'));
  const segment = BASE.replace(/^\/|\/$/g, '');
  await cp(dist, segment ? join(servedRoot, segment) : servedRoot, { recursive: true });

  const missing = [];
  const server = createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    let file = join(servedRoot, url);
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) {
      missing.push(url);
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`;

  const { chromium } = await import('playwright');
  let browser;
  try { browser = await chromium.launch(); }
  catch { browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); }

  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
  });

  try {
    console.log(`Serving dist/ at ${origin}${BASE}`);

    for (const [name, path] of [['home', ''], ['details', 'details.html'],
                                ['guest', 'guest.html?t=kasavu-gold']]) {
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('console', (m) => {
        if (m.type() !== 'error') return;
        const url = (m.location() && m.location().url) || '';
        errors.push(url ? `${m.text()} <- ${url}` : m.text());
      });

      console.log(`\n${name}`);
      const res = await page.goto(origin + BASE + path, { waitUntil: 'networkidle' });
      ok(`${name} loads`, res && res.status() === 200, String(res && res.status()));
      ok(`${name} fetches nothing that 404s`, errors.length === 0, errors.slice(0, 3).join(' | '));

      if (name === 'home') {
        const colours = await page.evaluate(() => {
          const c = document.querySelector('.design-art canvas');
          if (!c) return -1;
          const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
          const seen = new Set();
          for (let i = 0; i < d.length; i += 4 * 97) seen.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
          return seen.size;
        });
        ok('the design thumbnail draws (so the fonts resolved)', colours > 4, `${colours} colours`);

        const href = await page.locator('a.design[href*="details.html"]').first().getAttribute('href');
        ok('the design link keeps the sub-path', href && href.startsWith(BASE), href || 'none');
      }

      if (name === 'details') {
        // The real thing: make a video with the bundled worker.
        console.log('  making a video with the built worker...');
        const started = Date.now();
        await page.locator('#make').click();
        await page.waitForSelector('#view-ready:not([hidden])', { timeout: 180000 });
        const secs = ((Date.now() - started) / 1000).toFixed(1);

        const src = await page.locator('#ready-video').getAttribute('src');
        ok('the video renders end to end from the built bundle',
           !!src && src.startsWith('blob:'), `${secs}s`);
        ok('the download button points at the video',
           ((await page.locator('#download').getAttribute('href')) || '').startsWith('blob:'));
        ok('no ad slot on the ready screen', await page.locator('.ad-slot').count() === 0);
        ok('nothing threw while rendering', errors.length === 0, errors.slice(0, 2).join(' | '));

        const played = await page.evaluate(() => new Promise((r) => {
          const v = document.getElementById('ready-video');
          if (v.readyState >= 1) return r({ d: v.duration, w: v.videoWidth, h: v.videoHeight });
          v.onloadedmetadata = () => r({ d: v.duration, w: v.videoWidth, h: v.videoHeight });
          setTimeout(() => r(null), 15000);
        }));
        ok('the browser can play back what it just made',
           played && played.w === 720 && played.h === 1280,
           played ? `${played.w}x${played.h}, ${played.d.toFixed(1)}s` : 'no metadata');
      }

      await page.close();
    }

    ok('nothing anywhere asked for a file that is not in dist/',
       missing.length === 0, missing.slice(0, 4).join(', '));
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
    await rm(servedRoot, { recursive: true, force: true });
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length) process.exitCode = 1;
}

main().catch((err) => { console.error(err); process.exit(1); });
