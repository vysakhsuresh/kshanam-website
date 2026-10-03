/**
 * Drives the three screens in a phone-sized browser.
 *
 * Checks the things that would embarrass us on someone's phone: a page that
 * throws, a design thumbnail that renders blank, a live preview that does not
 * follow what is being typed, a language toggle that only changes half the
 * page, and anything that overflows sideways on a 390px screen.
 *
 *   node tests/screens.mjs            run the checks
 *   node tests/screens.mjs --shots    also write tests/output/screen-*.png
 */
import { createServer } from 'vite';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'tests/output');
const SHOTS = process.argv.includes('--shots');

const results = [];
const ok = (label, condition, detail = '') => {
  results.push({ label, pass: !!condition, detail });
  console.log(`  ${condition ? 'ok  ' : 'FAIL'} ${label}${detail ? `  (${detail})` : ''}`);
};

/** How many distinct colours a canvas actually drew. A blank one has 1. */
const CANVAS_COLOURS = `(sel) => {
  const c = document.querySelector(sel);
  if (!c) return -1;
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  const seen = new Set();
  for (let i = 0; i < d.length; i += 4 * 97) {
    seen.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
  }
  return seen.size;
}`;

async function main() {
  await mkdir(OUT, { recursive: true });

  const server = await createServer({
    root: resolve(ROOT, 'app'),
    configFile: resolve(ROOT, 'vite.config.js'),
    server: { port: 0, host: '127.0.0.1', hmr: false, watch: null },
    logLevel: 'warn',
  });
  await server.listen();
  const port = server.config.server.port || server.httpServer.address().port;
  const base = `http://127.0.0.1:${port}`;

  const { chromium } = await import('playwright');
  let browser;
  try { browser = await chromium.launch(); }
  catch { browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); }

  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    deviceScaleFactor: 2,
  });

  try {
    for (const [name, path] of [['home', '/'], ['details', '/details.html'],
                                ['guest', '/guest.html?t=kasavu-gold']]) {
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('console', (m) => {
        if (m.type() === 'error') {
          const url = (m.location() && m.location().url) || '';
          errors.push(url ? `${m.text()} <- ${url}` : m.text());
        }
      });

      console.log(`\n${name}`);
      const res = await page.goto(base + path, { waitUntil: 'networkidle' });
      ok(`${name} loads`, res && res.status() === 200, String(res && res.status()));
      ok(`${name} has exactly one h1`, await page.locator('h1').count() === 1);
      ok(`${name} throws nothing`, errors.length === 0, errors.slice(0, 2).join(' | '));
      ok(`${name} does not scroll sideways on a 390px phone`,
         await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
         await page.evaluate(() => `${document.documentElement.scrollWidth} > ${window.innerWidth}`));

      // Every tappable thing has to be big enough for a thumb.
      const small = await page.evaluate(() => {
        const bad = [];
        for (const el of document.querySelectorAll('button, a.btn, input, select')) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) continue;   // hidden
          if (r.height < 44) bad.push(`${el.tagName.toLowerCase()}.${el.className || '?'} ${Math.round(r.height)}px`);
        }
        return bad;
      });
      ok(`${name} tap targets are at least 44px`, small.length === 0, small.slice(0, 3).join(', '));

      if (SHOTS) await page.screenshot({ path: resolve(OUT, `screen-${name}.png`), fullPage: true });

      if (name === 'home') {
        await page.waitForFunction(`(${CANVAS_COLOURS})('.design-art canvas') > 4`, null, { timeout: 15000 })
          .catch(() => {});
        const colours = await page.evaluate(`(${CANVAS_COLOURS})('.design-art canvas')`);
        ok('the design thumbnail actually draws', colours > 4, `${colours} distinct colours`);

        const before = await page.locator('h1').textContent();
        await page.locator('.lang-toggle button[data-lang="ml"]').click();
        const after = await page.locator('h1').textContent();
        ok('the language toggle changes the headline', before !== after && /[ഀ-ൿ]/.test(after));
        ok('the occasion chips switch to Malayalam too',
           /[ഀ-ൿ]/.test(await page.locator('#occasions button').first().textContent()));
        await page.locator('.lang-toggle button[data-lang="en"]').click();

        ok('there is a design to tap into',
           await page.locator('a.design[href*="details.html"]').count() > 0);
      }

      if (name === 'details') {
        await page.waitForFunction(`(${CANVAS_COLOURS})('#preview') > 4`, null, { timeout: 15000 })
          .catch(() => {});
        const first = await page.evaluate(`(${CANVAS_COLOURS})('#preview')`);
        ok('the live preview draws', first > 4, `${first} distinct colours`);

        const before = await page.evaluate(() => document.getElementById('preview').toDataURL());
        await page.fill('#name1', 'Meenakshi');
        await page.waitForTimeout(400);
        const after = await page.evaluate(() => document.getElementById('preview').toDataURL());
        ok('the preview follows what is typed', before !== after);

        // Scrub to the opening title, which is the part that differs by
        // language. The names scene shows the same two names whatever the
        // invite language is, so comparing there proves nothing.
        await page.locator('#scrub').fill('8');
        await page.waitForTimeout(400);
        const titleBoth = await page.evaluate(() => document.getElementById('preview').toDataURL());
        await page.locator('#invite-lang button[data-value="en"]').click();
        await page.waitForTimeout(400);
        const titleEn = await page.evaluate(() => document.getElementById('preview').toDataURL());
        ok('changing the invite language redraws it', titleBoth !== titleEn);

        ok('the end card is on by default and switchable',
           await page.locator('#endCard').isChecked());

        // The editor must never carry ads, and neither must the other views.
        ok('no ads anywhere on the editor', await page.locator('.ad-slot').count() === 0);
        if (SHOTS) await page.screenshot({ path: resolve(OUT, 'screen-details-typed.png'), fullPage: true });
      }

      if (name === 'guest') {
        ok('the guest page names the design it came from',
           (await page.locator('#guest-name').textContent()).includes('Kasavu'));
        ok('"Use this design" keeps the design',
           (await page.locator('#use').getAttribute('href') || '').includes('kasavu-gold'));
      }

      await page.close();
    }
  } finally {
    await browser.close();
    await server.close();
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length) process.exitCode = 1;
}

main().catch((err) => { console.error(err); process.exit(1); });
