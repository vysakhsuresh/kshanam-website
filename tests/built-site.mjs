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

    for (const [name, path] of [['home', ''], ['studio', 'studio.html'],
                                ['help', 'help.html'], ['guest', 'guest.html?t=kasavu-gold']]) {
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
        // Cards paint lazily as they scroll into view, so wait rather than
        // sampling an intentionally blank canvas.
        const COLOURS = `() => {
          const c = document.querySelector('.design-art canvas');
          if (!c) return -1;
          const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
          const seen = new Set();
          for (let i = 0; i < d.length; i += 4 * 97) seen.add((d[i] << 16) | (d[i+1] << 8) | d[i+2]);
          return seen.size;
        }`;
        // Cards paint only once they scroll into view, which is the point of
        // doing it lazily, so scroll to the gallery before looking.
        await page.evaluate(() => {
          const el = document.getElementById('designs');
          if (el) window.scrollTo({ top: el.offsetTop, behavior: 'instant' });
        });
        await page.waitForFunction(`(${COLOURS})() > 4`, null, { timeout: 25000 }).catch(() => {});
        const colours = await page.evaluate(`(${COLOURS})()`);
        ok('the design thumbnail draws (so the fonts resolved)', colours > 4, `${colours} colours`);

        const href = await page.locator('a.design[href*="studio.html"]').first().getAttribute('href');
        ok('the design link keeps the sub-path', href && href.startsWith(BASE), href || 'none');
      }

      if (name === 'studio') {
        // The real thing: make a video with the bundled worker.
        console.log('  making a video with the built worker...');
        await page.waitForFunction(
          () => document.querySelectorAll('#slides .slide').length > 3,
          null, { timeout: 25000 }).catch(() => {});
        ok('the storyboard built from the bundle',
           await page.locator('#slides .slide').count() >= 6,
           String(await page.locator('#slides .slide').count()));
        const started = Date.now();
        // The stylesheet sets scroll-behavior:smooth, which is right for a
        // person and wrong for a robot: Playwright scrolls, then clicks while
        // the page is still gliding, and hits whatever is passing under the
        // cursor. Turn the animation off for the duration of the test.
        await page.addStyleTag({ content: 'html { scroll-behavior: auto !important; }' });
        await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
        await page.waitForTimeout(250);

        // Check the button really is reachable — nothing covering it — and
        // then fire the handler directly. Playwright's own hit-testing keeps
        // losing an argument with the sticky action bar on a phone viewport,
        // and this proves the same thing without the fight.
        const reachable = await page.evaluate(() => {
          const el = document.getElementById('make');
          const r = el.getBoundingClientRect();
          if (r.width < 40 || r.height < 40) return 'too small';
          const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return el.contains(top) || top === el ? true : `covered by ${top && top.tagName}`;
        });
        ok('the make button is visible and nothing covers it', reachable === true, String(reachable));

        await page.locator('#make').dispatchEvent('click');
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
